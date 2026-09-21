import os
from datetime import datetime, timedelta, timezone

import bcrypt
from bson import ObjectId

NOW = datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))


async def refresh_gamification(db, user_id):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return
    badges = []
    if user.get("role") == "worker":
        done = await db.issues.count_documents({"assigned_to.id": str(user_id), "status": "Resolved"})
        points = done * 15
        if done >= 1:
            badges.append("First Fix")
        if done >= 3:
            badges.append("Rapid Responder")
        if done >= 8:
            badges.append("City Guardian")
    else:
        reports = await db.issues.count_documents({"author_id": str(user_id)})
        resolved = await db.issues.count_documents({"author_id": str(user_id), "status": "Resolved"})
        points = reports * 10 + resolved * 25
        if reports >= 1:
            badges.append("First Report")
        if reports >= 5:
            badges.append("Eagle Eye")
        if resolved >= 2:
            badges.append("Fix Finder")
        if points >= 100:
            badges.append("Community Hero")
        if await db.issues.count_documents({"author_id": str(user_id), "status": "Resolved", "category": "roads"}) >= 1:
            badges.append("Pothole Patrol")
        if await db.issues.count_documents({"author_id": str(user_id), "status": "Resolved", "category": "sanitation"}) >= 1:
            badges.append("Eco Guardian")
    await db.users.update_one({"_id": user_id}, {"$set": {"points": points, "badges": badges}})


WORKERS = [
    {"name": "Arjun Mehta", "email": "worker1@fixmycity.gov", "dept": "Road Works"},
    {"name": "Priya Sharma", "email": "worker2@fixmycity.gov", "dept": "Water Board"},
    {"name": "Karan Singh", "email": "worker3@fixmycity.gov", "dept": "Electrical"},
    {"name": "Neha Verma", "email": "worker4@fixmycity.gov", "dept": "Sanitation"},
]

CITIZENS = [
    {"name": "Demo Citizen", "email": "demo@fixmycity.app", "password": "demo123"},
    {"name": "Aisha Khan", "email": "aisha@example.com", "password": "citizen123"},
    {"name": "Rohan Patel", "email": "rohan@example.com", "password": "citizen123"},
    {"name": "Meera Iyer", "email": "meera@example.com", "password": "citizen123"},
    {"name": "Dev Nair", "email": "dev@example.com", "password": "citizen123"},
]

# description, category, status, image, area, lat, lng, age_days, upvotes, author_email,
# worker_email(or None), deadline_days_from_now(or None), resolved_days_ago(or None), resolution_image(or None)
ISSUES = [
    ("Massive pothole near Sony World signal, two-wheelers swerving dangerously around it", "roads", "Pending", "road1.jpg", "Koramangala", 12.9362, 77.6255, 2, 14, "aisha@example.com", None, None, None, None),
    ("Road caved in after metro work, water collects here every rain", "roads", "In Progress", "road2.jpg", "Indiranagar", 12.9729, 77.6422, 9, 31, "rohan@example.com", "worker1@fixmycity.gov", 3, None, None),
    ("Crater-sized pothole at 100 Ft Road junction, fixed quickly after reports", "roads", "Resolved", "road3.jpg", "Indiranagar", 12.9709, 77.6402, 20, 47, "meera@example.com", "worker1@fixmycity.gov", None, 6, "after1.jpg"),
    ("Broken patch causing daily bike skids near the bus stop", "roads", "Assigned", "road4.jpg", "HSR Layout", 12.9126, 77.6484, 5, 9, "aisha@example.com", "worker1@fixmycity.gov", 2, None, None),
    ("Entire stretch dug up and left unattended for weeks, dust everywhere", "roads", "Pending", "road2.jpg", "Electronic City", 12.8462, 77.6612, 1, 6, "meera@example.com", None, None, None, None),
    ("Three streetlights dead on 5th Cross, pitch dark at night", "streetlights", "Pending", "streetlight1.jpg", "HSR Layout", 12.9106, 77.6464, 3, 22, "demo@fixmycity.app", None, None, None, None),
    ("Street lamp fallen after the storm, live wires exposed on the pavement", "streetlights", "In Progress", "streetlight2.jpg", "Jayanagar", 12.9318, 77.5848, 7, 18, "rohan@example.com", "worker3@fixmycity.gov", 1, None, None),
    ("Flickering lamp near park entrance, unsafe for evening walkers", "streetlights", "Resolved", "streetlight3.jpg", "Indiranagar", 12.9739, 77.6432, 15, 11, "dev@example.com", "worker3@fixmycity.gov", None, 2, "after1.jpg"),
    ("Water pipe burst, flooding the entire lane since morning", "water", "In Progress", "water1.jpg", "Koramangala", 12.9342, 77.6235, 4, 35, "aisha@example.com", "worker2@fixmycity.gov", -1, None, None),
    ("Leakage from the main line, clean water wasted for a week", "water", "Pending", "water2.jpg", "Whitefield", 12.9708, 77.7510, 2, 8, "rohan@example.com", None, None, None, None),
    ("Sewage overflow near the market, unbearable smell", "water", "Assigned", "water1.jpg", "Jayanagar", 12.9298, 77.5828, 6, 27, "meera@example.com", "worker2@fixmycity.gov", 1, None, None),
    ("Drinking water contamination complaint after pipeline repair work", "water", "Resolved", "water2.jpg", "Hebbal", 13.0368, 77.5980, 25, 19, "dev@example.com", "worker2@fixmycity.gov", None, 10, "after1.jpg"),
    ("Garbage not collected for 10 days, stray animals scattering waste", "sanitation", "Pending", "garbage1.jpg", "HSR Layout", 12.9136, 77.6494, 1, 41, "aisha@example.com", None, None, None, None),
    ("Overflowing community bin turning into a health hazard", "sanitation", "Assigned", "garbage2.jpg", "Koramangala", 12.9372, 77.6265, 3, 13, "dev@example.com", "worker4@fixmycity.gov", 3, None, None),
    ("Construction debris dumped on the footpath blocking pedestrians", "sanitation", "Resolved", "garbage3.jpg", "MG Road", 12.9767, 77.6023, 18, 16, "aisha@example.com", "worker4@fixmycity.gov", None, 4, None),
    ("Trash pile behind the bus stand growing bigger every day", "sanitation", "Pending", "garbage3.jpg", "Hebbal", 13.0348, 77.5960, 4, 5, "rohan@example.com", None, None, None, None),
    ("Transformer sparking, power cuts every evening in the block", "electricity", "In Progress", "electricity1.jpg", "Whitefield", 12.9688, 77.7490, 5, 29, "meera@example.com", "worker3@fixmycity.gov", 2, None, None),
    ("Dangling wire hanging over the playground, extremely dangerous for kids", "electricity", "Pending", "electricity2.jpg", "Jayanagar", 12.9328, 77.5858, 1, 52, "demo@fixmycity.app", None, None, None, None),
    ("Street fuse box door broken open, short-circuit risk in rain", "electricity", "Resolved", "electricity2.jpg", "MG Road", 12.9747, 77.6003, 22, 9, "rohan@example.com", "worker3@fixmycity.gov", None, 8, None),
    ("Collapsed compound wall blocking half the sidewalk", "other", "Pending", "other1.jpg", "Indiranagar", 12.9749, 77.6442, 6, 7, "dev@example.com", None, None, None, None),
]


async def seed_database(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fixmycity.gov").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin is None:
        await db.users.insert_one({
            "name": "Pratham Giri",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "points": 0,
            "badges": [],
            "created_at": NOW,
        })
    elif not verify_password(admin_password, existing_admin["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.issues.count_documents({}) > 0:
        return

    users = {}
    for w in WORKERS:
        res = await db.users.insert_one({
            "name": w["name"], "email": w["email"], "password_hash": hash_password("worker123"),
            "role": "worker", "dept": w["dept"], "points": 0, "badges": [], "created_at": NOW,
        })
        users[w["email"]] = {"id": str(res.inserted_id), "name": w["name"], "dept": w["dept"]}

    for c in CITIZENS:
        res = await db.users.insert_one({
            "name": c["name"], "email": c["email"], "password_hash": hash_password(c["password"]),
            "role": "citizen", "points": 0, "badges": [], "created_at": NOW,
        })
        users[c["email"]] = {"id": str(res.inserted_id), "name": c["name"]}

    for (desc, cat, status, img, area, lat, lng, age, up, author_email, worker_email, dl_days, res_days, res_img) in ISSUES:
        created = NOW - timedelta(days=age, hours=age % 5)
        author = users[author_email]
        worker = users.get(worker_email) if worker_email else None
        resolved_at = NOW - timedelta(days=res_days) if res_days is not None else None
        deadline = (NOW + timedelta(days=dl_days)) if dl_days is not None else None
        timeline = [{"status": "Pending", "at": created, "note": "Report submitted by citizen"}]
        if status in ("Assigned", "In Progress", "Resolved") and worker:
            timeline.append({"status": "Assigned", "at": created + timedelta(hours=5), "note": f"Assigned to {worker['name']} ({worker['dept']})"})
        if status in ("In Progress", "Resolved"):
            timeline.append({"status": "In Progress", "at": created + timedelta(days=1), "note": "Field team started work on site"})
        if status == "Resolved":
            timeline.append({"status": "Resolved", "at": resolved_at, "note": "Issue resolved with photo proof"})
        await db.issues.insert_one({
            "description": desc,
            "category": cat,
            "status": status,
            "image_url": f"/api/uploads/seed/{img}",
            "resolution_image": f"/api/uploads/seed/{res_img}" if res_img else None,
            "lat": lat,
            "lng": lng,
            "address": f"{area}, Bengaluru",
            "area": area,
            "author_id": author["id"],
            "author_name": author["name"],
            "upvotes": [str(ObjectId()) for _ in range(up)],
            "assigned_to": ({"id": worker["id"], "name": worker["name"], "dept": worker["dept"]} if worker else None),
            "deadline": deadline,
            "timeline": timeline,
            "ai_confidence": round(0.82 + (age % 15) / 100, 2),
            "created_at": created,
            "resolved_at": resolved_at,
        })

    for email, u in users.items():
        await refresh_gamification(db, ObjectId(u["id"]))
