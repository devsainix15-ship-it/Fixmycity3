from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import base64
import json
import logging
import math
import os
import re
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, field_validator
from starlette.middleware.cors import CORSMiddleware
import io
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from seed import seed_database, refresh_gamification

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    # Read-only filesystem (e.g. Vercel serverless): fall back to the temp dir.
    # Files here are EPHEMERAL - use external object storage in production.
    UPLOAD_DIR = Path(tempfile.gettempdir()) / "fmc_uploads"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logging.getLogger("fixmycity").warning(
        "Upload dir is not writable; using ephemeral %s. Use external object storage in production.", UPLOAD_DIR
    )

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

CATEGORIES = ["electricity", "roads", "water", "sanitation", "streetlights", "other"]
STATUS_FLOW = ["Pending", "Assigned", "In Progress", "Resolved"]

app = FastAPI(title="FixMyCity API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("fixmycity")
logging.basicConfig(level=logging.INFO)


# ---------------- auth helpers ----------------

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user) -> str:
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def pub_user(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", "Citizen"),
        "email": doc.get("email"),
        "role": doc.get("role", "citizen"),
        "dept": doc.get("dept"),
        "points": doc.get("points", 0),
        "badges": doc.get("badges", []),
    }


async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# ---------------- issue serialization ----------------

def iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


def pub_media(doc) -> list:
    """Ordered media list. Falls back to the legacy single image_url for older issues."""
    media = doc.get("media")
    if media:
        return [
            {"url": m.get("url"), "type": m.get("type", "image"), "thumbnail_url": m.get("thumbnail_url")}
            for m in media
        ]
    if doc.get("image_url"):
        return [{"url": doc["image_url"], "type": "image", "thumbnail_url": None}]
    return []


def pub_issue(doc, me_id: Optional[str] = None) -> dict:
    return {
        "id": str(doc["_id"]),
        "description": doc.get("description", ""),
        "category": doc.get("category", "other"),
        "status": doc.get("status", "Pending"),
        "image_url": doc.get("image_url"),
        "media": pub_media(doc),
        "resolution_image": doc.get("resolution_image"),
        "lat": doc.get("lat"),
        "lng": doc.get("lng"),
        "address": doc.get("address", ""),
        "area": doc.get("area", ""),
        "author": {"id": doc.get("author_id"), "name": doc.get("author_name", "Citizen")},
        "upvotes": len(doc.get("upvotes", [])),
        "upvoted": bool(me_id and me_id in doc.get("upvotes", [])),
        "assigned_to": doc.get("assigned_to"),
        "deadline": iso(doc.get("deadline")),
        "timeline": [
            {"status": t.get("status"), "at": iso(t.get("at")), "note": t.get("note", "")}
            for t in doc.get("timeline", [])
        ],
        "ai_confidence": doc.get("ai_confidence"),
        "created_at": iso(doc.get("created_at")),
        "resolved_at": iso(doc.get("resolved_at")),
    }


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        try:
            return datetime.strptime(str(s)[:10], "%Y-%m-%d")
        except Exception:
            return None


# ---------------- media helpers ----------------

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXT = {".mp4", ".webm", ".mov"}
ALLOWED_EXT = IMAGE_EXT | VIDEO_EXT
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024
MAX_IMAGES_PER_ISSUE = 5
MAX_VIDEOS_PER_ISSUE = 1

# extension -> real content type we expect to find in the file's first bytes
EXT_KIND = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp", ".mp4": "mp4", ".mov": "mp4", ".webm": "webm"}
NON_VIDEO_BRANDS = {b"heic", b"heix", b"hevc", b"mif1", b"msf1", b"avif", b"avis"}
MEDIA_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
}
UPLOAD_URL_PREFIX = "/api/uploads/"


def sniff_media_kind(head: bytes) -> Optional[str]:
    """Identify the real file type from its first bytes (never trust extension or Content-Type)."""
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"
    if head[4:8] == b"ftyp" and head[8:12] not in NON_VIDEO_BRANDS:
        return "mp4"  # ISO-BMFF: covers .mp4 and .mov (QuickTime)
    return None


def clean_media_url(url: str, allowed=ALLOWED_EXT) -> str:
    """Only accept files that came from our own /api/upload; return a normalised relative URL."""
    if UPLOAD_URL_PREFIX not in url:
        raise ValueError("Media must be uploaded through /api/upload")
    rel = url.split(UPLOAD_URL_PREFIX, 1)[1].split("?", 1)[0].lstrip("/")
    if not rel or ".." in rel or "\\" in rel:
        raise ValueError("Invalid media path")
    if os.path.splitext(rel)[1].lower() not in allowed:
        raise ValueError("Unsupported media type")
    return UPLOAD_URL_PREFIX + rel


def parse_range(header: str, size: int):
    """Parse a single HTTP 'Range: bytes=a-b' header. Returns (start, end) inclusive, or None if unsatisfiable."""
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", (header or "").strip())
    if not m or (m.group(1) == "" and m.group(2) == ""):
        return None
    if m.group(1) == "":  # suffix range: last N bytes
        n = int(m.group(2))
        if n == 0:
            return None
        start, end = max(size - n, 0), size - 1
    else:
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
    if size == 0 or start > end or start >= size:
        return None
    return start, end


# ---------------- request models ----------------

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ClassifyIn(BaseModel):
    image_url: Optional[str] = None
    description: str = ""


class MediaItem(BaseModel):
    url: str
    type: Literal["image", "video"] = "image"
    thumbnail_url: Optional[str] = None


class IssueIn(BaseModel):
    description: str
    category: str = "other"
    lat: float
    lng: float
    address: str = ""
    area: str = ""
    image_url: Optional[str] = None  # legacy single-image field, still accepted
    media: List[MediaItem] = Field(default_factory=list, max_length=MAX_IMAGES_PER_ISSUE + MAX_VIDEOS_PER_ISSUE)
    ai_confidence: Optional[float] = None

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, v):
        return clean_media_url(v, IMAGE_EXT) if v else None

    @field_validator("media")
    @classmethod
    def check_media(cls, v):
        cleaned = []
        for m in v:
            url = clean_media_url(m.url)
            # derive the type from the file extension; do not trust the client
            kind = "video" if os.path.splitext(url)[1].lower() in VIDEO_EXT else "image"
            thumb = clean_media_url(m.thumbnail_url, IMAGE_EXT) if m.thumbnail_url else None
            cleaned.append(MediaItem(url=url, type=kind, thumbnail_url=thumb))
        if sum(m.type == "video" for m in cleaned) > MAX_VIDEOS_PER_ISSUE:
            raise ValueError("Only 1 video allowed per issue")
        if sum(m.type == "image" for m in cleaned) > MAX_IMAGES_PER_ISSUE:
            raise ValueError("Maximum 5 photos allowed")
        return cleaned


class AssignIn(BaseModel):
    worker_id: str
    deadline: Optional[str] = None
    note: Optional[str] = ""


class StatusIn(BaseModel):
    status: str
    note: Optional[str] = ""
    resolution_image: Optional[str] = None



# ---------------- auth routes ----------------

@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "citizen",
        "points": 0,
        "badges": [],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"token": create_token(doc), "user": pub_user(doc)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "user": pub_user(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return pub_user(user)


# ---------------- uploads ----------------

@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, "Unsupported file type. Use JPG, PNG, WEBP, MP4, WEBM or MOV")

    is_video = ext in VIDEO_EXT
    limit = MAX_VIDEO_BYTES if is_video else MAX_IMAGE_BYTES
    fname = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / fname

    size = 0
    try:
        with open(path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1 MB at a time
                if size == 0 and sniff_media_kind(chunk[:16]) != EXT_KIND[ext]:
                    raise HTTPException(415, "File content does not match its extension")
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File too large (max {limit // (1024 * 1024)}MB)")
                f.write(chunk)
        if size == 0:
            raise HTTPException(400, "Empty file")
    except HTTPException:
        path.unlink(missing_ok=True)  # remove the partial file
        raise
    except OSError:
        path.unlink(missing_ok=True)
        logger.exception("Could not save upload")
        raise HTTPException(500, "Could not save file")

    return {"url": f"{UPLOAD_URL_PREFIX}{fname}", "type": "video" if is_video else "image"}


def _iter_file(path: Path, start: int, end: int, chunk_size: int = 64 * 1024):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@api.get("/uploads/{file_path:path}")
async def serve_upload(file_path: str, request: Request):
    """Serve uploaded media with HTTP Range support (required for <video> seeking/playback, esp. iOS Safari)."""
    root = UPLOAD_DIR.resolve()
    p = (UPLOAD_DIR / file_path).resolve()
    ctype = MEDIA_TYPES.get(p.suffix.lower())
    if not ctype or not p.is_relative_to(root) or not p.is_file():
        raise HTTPException(404, "File not found")

    size = p.stat().st_size
    base_headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    range_header = request.headers.get("range")
    if range_header:
        rng = parse_range(range_header, size)
        if rng is None:
            raise HTTPException(416, "Range not satisfiable", headers={"Content-Range": f"bytes */{size}"})
        start, end = rng
        headers = {**base_headers, "Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(end - start + 1)}
        return StreamingResponse(_iter_file(p, start, end), status_code=206, media_type=ctype, headers=headers)
    return FileResponse(p, media_type=ctype, headers=base_headers)


# ---------------- AI classification ----------------

KEYWORDS = {
    "roads": ["pothole", "road", "asphalt", "crater", "pavement", "footpath", "speed breaker", "caved"],
    "water": ["water", "leak", "pipe", "flood", "sewage", "drain", "overflow", "burst"],
    "sanitation": ["garbage", "trash", "waste", "bin", "debris", "litter", "dump", "smell"],
    "streetlights": ["streetlight", "street light", "lamp", "light pole", "dark", "flickering"],
    "electricity": ["transformer", "wire", "power", "electricity", "electric", "fuse", "sparking"],
}


@api.post("/issues/classify")
async def classify(body: ClassifyIn, user=Depends(current_user)):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if key and body.image_url:
        try:
            rel = body.image_url.split("/api/uploads/")[-1].split("?")[0].lstrip("/")
            fpath = (UPLOAD_DIR / rel).resolve()
            # images only (never send a video to the vision model); is_relative_to blocks path tricks
            if fpath.suffix.lower() in IMAGE_EXT and fpath.is_relative_to(UPLOAD_DIR.resolve()) and fpath.is_file():
                b64 = base64.b64encode(fpath.read_bytes()).decode()
                from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

                chat = LlmChat(
                    api_key=key,
                    session_id=f"classify-{uuid.uuid4().hex[:8]}",
                    system_message="You are an AI that classifies civic infrastructure issue photos into exactly one category.",
                ).with_model("openai", "gpt-5.4-mini")
                prompt = (
                    "Classify this civic issue photo into EXACTLY ONE of these categories: "
                    "electricity, roads, water, sanitation, streetlights, other.\n"
                    f"Citizen description (may be empty): {body.description[:300]}\n"
                    'Respond with ONLY a JSON object: {"category": "<one of the categories>", '
                    '"confidence": <0.0-1.0>, "reason": "<one short sentence>"}'
                )
                resp = await chat.send_message(
                    UserMessage(text=prompt, file_contents=[ImageContent(image_base64=b64)])
                )
                m = re.search(r"\{.*\}", resp, re.S)
                data = json.loads(m.group(0))
                cat = str(data.get("category", "")).lower().strip()
                if cat in CATEGORIES:
                    return {
                        "category": cat,
                        "confidence": min(0.99, max(0.5, float(data.get("confidence", 0.85)))),
                        "reason": str(data.get("reason", ""))[:200],
                        "source": "ai",
                    }
        except Exception as e:
            logger.warning(f"AI classify failed, using fallback: {e}")
    text = (body.description or "").lower()
    for cat, words in KEYWORDS.items():
        if any(w in text for w in words):
            return {"category": cat, "confidence": 0.6, "reason": "Matched keywords in description", "source": "keyword"}
    return {"category": "other", "confidence": 0.4, "reason": "No strong signal detected", "source": "fallback"}


# ---------------- issues ----------------

@api.post("/issues")
async def create_issue(body: IssueIn, user=Depends(current_user)):
    cat = body.category if body.category in CATEGORIES else "other"
    now = datetime.now(timezone.utc)

    media = [m.model_dump() for m in body.media]
    # support old-style requests that only send image_url
    if not media and body.image_url:
        media = [{"url": body.image_url, "type": "image", "thumbnail_url": None}]
    # keep image_url as the first photo so the classifier and older code keep working
    first_image = next((m["url"] for m in media if m["type"] == "image"), None)

    doc = {
        "description": body.description.strip(),
        "category": cat,
        "status": "Pending",
        "image_url": first_image,
        "media": media,
        "resolution_image": None,
        "lat": body.lat,
        "lng": body.lng,
        "address": body.address.strip(),
        "area": body.area.strip() or "Unspecified",
        "author_id": str(user["_id"]),
        "author_name": user.get("name", "Citizen"),
        "upvotes": [],
        "assigned_to": None,
        "deadline": None,
        "timeline": [{"status": "Pending", "at": now, "note": "Report submitted"}],
        "ai_confidence": body.ai_confidence,
        "created_at": now,
        "resolved_at": None,
    }
    res = await db.issues.insert_one(doc)
    doc["_id"] = res.inserted_id
    await refresh_gamification(db, user["_id"])
    return pub_issue(doc, str(user["_id"]))


@api.get("/issues")
async def list_issues(
    status: Optional[str] = None,
    category: Optional[str] = None,
    area: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    sort: str = "recent",
    user=Depends(current_user),
):
    q = {}
    if status and status != "all":
        q["status"] = status
    if category and category != "all":
        q["category"] = category
    if area:
        q["area"] = {"$regex": area, "$options": "i"}
    docs = await db.issues.find(q).to_list(2000)
    me_id = str(user["_id"])
    out = []
    for d in docs:
        item = pub_issue(d, me_id)
        if lat is not None and lng is not None and d.get("lat") and d.get("lng"):
            item["distance_km"] = round(haversine_km(lat, lng, d["lat"], d["lng"]), 1)
        else:
            item["distance_km"] = None
        out.append(item)
    if sort == "nearest" and lat is not None:
        out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    elif sort == "top":
        out.sort(key=lambda x: -x["upvotes"])
    else:
        out.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return out


@api.get("/issues/mine")
async def my_issues(user=Depends(current_user)):
    docs = await db.issues.find({"author_id": str(user["_id"])}).to_list(500)
    out = [pub_issue(d, str(user["_id"])) for d in docs]
    out.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return out


@api.post("/issues/{issue_id}/upvote")
async def upvote(issue_id: str, user=Depends(current_user)):
    try:
        oid = ObjectId(issue_id)
    except Exception:
        raise HTTPException(404, "Issue not found")
    doc = await db.issues.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Issue not found")
    me_id = str(user["_id"])
    upvotes = doc.get("upvotes", [])
    if me_id in upvotes:
        await db.issues.update_one({"_id": oid}, {"$pull": {"upvotes": me_id}})
    elif doc.get("author_id") != me_id:
        await db.issues.update_one({"_id": oid}, {"$push": {"upvotes": me_id}})
    doc = await db.issues.find_one({"_id": oid})
    return pub_issue(doc, me_id)


# ---------------- admin ----------------

@api.get("/workers")
async def list_workers(admin=Depends(require_admin)):
    docs = await db.users.find({"role": "worker"}).to_list(100)
    out = []
    for w in docs:
        resolved = await db.issues.count_documents({"assigned_to.id": str(w["_id"]), "status": "Resolved"})
        active = await db.issues.count_documents({"assigned_to.id": str(w["_id"]), "status": {"$in": ["Assigned", "In Progress"]}})
        u = pub_user(w)
        u["resolved_count"] = resolved
        u["active_count"] = active
        out.append(u)
    return out


@api.patch("/issues/{issue_id}/assign")
async def assign_issue(issue_id: str, body: AssignIn, admin=Depends(require_admin)):
    try:
        oid = ObjectId(issue_id)
        woid = ObjectId(body.worker_id)
    except Exception:
        raise HTTPException(400, "Invalid id")
    issue = await db.issues.find_one({"_id": oid})
    worker = await db.users.find_one({"_id": woid, "role": "worker"})
    if not issue:
        raise HTTPException(404, "Issue not found")
    if not worker:
        raise HTTPException(404, "Worker not found")
    now = datetime.now(timezone.utc)
    new_status = "Assigned" if issue["status"] == "Pending" else issue["status"]
    update = {
        "assigned_to": {"id": str(worker["_id"]), "name": worker["name"], "dept": worker.get("dept", "Field Ops")},
        "deadline": parse_dt(body.deadline),
        "status": new_status,
    }
    note = body.note or f"Assigned to {worker['name']} ({worker.get('dept', 'Field Ops')})"
    await db.issues.update_one(
        {"_id": oid},
        {"$set": update, "$push": {"timeline": {"status": "Assigned", "at": now, "note": note}}},
    )
    doc = await db.issues.find_one({"_id": oid})
    return pub_issue(doc, str(admin["_id"]))


@api.patch("/issues/{issue_id}/status")
async def update_status(issue_id: str, body: StatusIn, user=Depends(current_user)):
    if body.status not in STATUS_FLOW:
        raise HTTPException(400, "Invalid status")
    try:
        oid = ObjectId(issue_id)
    except Exception:
        raise HTTPException(404, "Issue not found")
    issue = await db.issues.find_one({"_id": oid})
    if not issue:
        raise HTTPException(404, "Issue not found")
    me_id = str(user["_id"])
    if user["role"] == "worker":
        assigned = (issue.get("assigned_to") or {}).get("id")
        if assigned != me_id:
            raise HTTPException(403, "Not your assigned task")
        if body.status not in ("In Progress", "Resolved"):
            raise HTTPException(403, "Workers can only set In Progress or Resolved")
    elif user["role"] != "admin":
        raise HTTPException(403, "Not allowed")
    now = datetime.now(timezone.utc)
    update = {"status": body.status}
    if body.status == "Resolved":
        update["resolved_at"] = now
        if body.resolution_image:
            update["resolution_image"] = body.resolution_image
    note = body.note or f"Status changed to {body.status}"
    await db.issues.update_one(
        {"_id": oid}, {"$set": update, "$push": {"timeline": {"status": body.status, "at": now, "note": note}}}
    )
    if body.status == "Resolved" and issue["status"] != "Resolved":
        try:
            await refresh_gamification(db, ObjectId(issue["author_id"]))
        except Exception:
            pass
        assigned = (issue.get("assigned_to") or {}).get("id")
        if assigned:
            try:
                await refresh_gamification(db, ObjectId(assigned))
            except Exception:
                pass
    doc = await db.issues.find_one({"_id": oid})
    return pub_issue(doc, me_id)


@api.get("/tasks")
async def tasks(worker_id: Optional[str] = None, user=Depends(current_user)):
    if user["role"] == "worker":
        wid = str(user["_id"])
    elif user["role"] == "admin":
        wid = worker_id
    else:
        raise HTTPException(403, "Not allowed")
    q = {"assigned_to": {"$ne": None}}
    if wid:
        q["assigned_to.id"] = wid
    docs = await db.issues.find(q).to_list(500)
    out = [pub_issue(d, str(user["_id"])) for d in docs]
    order = {"In Progress": 0, "Assigned": 1, "Resolved": 2, "Pending": 3}
    out.sort(key=lambda x: (order.get(x["status"], 4), x["deadline"] or "9999"))
    return out


@api.get("/analytics")
async def analytics(admin=Depends(require_admin)):
    issues = await db.issues.find().to_list(5000)
    by_status = {s: 0 for s in STATUS_FLOW}
    by_category = {c: 0 for c in CATEGORIES}
    area_map = {}
    res_hours = []
    today = datetime.now(timezone.utc).date()
    trend = {}
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        trend[d.isoformat()] = {"date": d.strftime("%b %d"), "reported": 0, "resolved": 0}
    for it in issues:
        by_status[it["status"]] = by_status.get(it["status"], 0) + 1
        by_category[it.get("category", "other")] = by_category.get(it.get("category", "other"), 0) + 1
        area = it.get("area") or "Unknown"
        area_map[area] = area_map.get(area, 0) + 1
        ca, ra = it.get("created_at"), it.get("resolved_at")
        if ca and ca.date().isoformat() in trend:
            trend[ca.date().isoformat()]["reported"] += 1
        if ra:
            if ra.date().isoformat() in trend:
                trend[ra.date().isoformat()]["resolved"] += 1
            if ca:
                res_hours.append(max((ra - ca).total_seconds() / 3600.0, 0.5))
    avg_res = round(sum(res_hours) / len(res_hours), 1) if res_hours else 0
    resolved = by_status.get("Resolved", 0)
    return {
        "total": len(issues),
        "active": len(issues) - resolved,
        "resolved": resolved,
        "resolution_rate": round(100 * resolved / len(issues), 1) if issues else 0,
        "avg_resolution_hours": avg_res,
        "by_status": [{"name": k, "value": v} for k, v in by_status.items()],
        "by_category": [{"name": k, "value": v} for k, v in by_category.items()],
        "by_area": sorted([{"name": k, "value": v} for k, v in area_map.items()], key=lambda x: -x["value"])[:8],
        "trend": list(trend.values()),
    }


# ---------------- public / gamification ----------------
@api.get("/admin/report/pdf")
async def export_pdf(admin=Depends(require_admin)):
    issues = await db.issues.find().sort("created_at", -1).to_list(5000)
    total = len(issues)
    resolved = sum(1 for i in issues if i.get("status") == "Resolved")
    pending = total - resolved

    buf = io.BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20, rightMargin=20, topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()

    story = [
        Paragraph("FixMyCity - Complaints Report", styles["Title"]),
        Paragraph(datetime.now().strftime("Generated on %d %b %Y, %H:%M"), styles["Normal"]),
        Spacer(1, 12),
        Paragraph(f"Total: {total} | Resolved: {resolved} | Pending: {pending}", styles["Heading3"]),
        Spacer(1, 12),
    ]

    rows = [["ID", "Category", "Area", "Status", "Assigned To", "Date"]]
    for it in issues:
        created = it.get("created_at")
        rows.append([
            str(it["_id"])[-6:],
            it.get("category", "other"),
            (it.get("area") or "-")[:22],
            it.get("status", "Pending"),
            (it.get("assigned_to") or {}).get("name", "-"),
            created.strftime("%d %b %Y") if created else "-",
        ])

    table = Table(rows, colWidths=[50, 80, 120, 80, 120, 80], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
    ]))
    story.append(table)

    pdf.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=fixmycity_report.pdf"},
    )

@api.get("/public/stats")
async def public_stats():
    total = await db.issues.count_documents({})
    resolved = await db.issues.count_documents({"status": "Resolved"})
    citizens = await db.users.count_documents({"role": "citizen"})
    return {"total": total, "resolved": resolved, "citizens": citizens}


@api.get("/leaderboard")
async def leaderboard(user=Depends(current_user)):
    docs = await db.users.find({"role": "citizen"}).sort("points", -1).to_list(20)
    out = []
    for i, u in enumerate(docs):
        reports = await db.issues.count_documents({"author_id": str(u["_id"])})
        resolved = await db.issues.count_documents({"author_id": str(u["_id"]), "status": "Resolved"})
        out.append(
            {
                "rank": i + 1,
                "id": str(u["_id"]),
                "name": u.get("name", "Citizen"),
                "points": u.get("points", 0),
                "badges": u.get("badges", []),
                "reports": reports,
                "resolved": resolved,
            }
        )
    return out


@api.get("/")
async def root():
    return {"message": "FixMyCity API running"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.issues.create_index("status")
    await db.issues.create_index("category")
    await seed_database(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()