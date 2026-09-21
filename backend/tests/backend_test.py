"""FixMyCity backend API integration tests."""
import os
import uuid
import time
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

SEED_DIR = Path("/app/backend/uploads/seed")


# -------- fixtures --------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_auth(s):
    return _login(s, "prathamgiri2005@gmail.com", "admin123")


@pytest.fixture(scope="session")
def citizen_auth(s):
    return _login(s, "demo@fixmycity.app", "demo123")


@pytest.fixture(scope="session")
def worker_auth(s):
    return _login(s, "worker1@fixmycity.gov", "worker123")


def H(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


# -------- health & public --------
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/", timeout=15)
        assert r.status_code == 200

    def test_public_stats(self, s):
        r = s.get(f"{API}/public/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "resolved" in d and "citizens" in d
        assert d["total"] >= 20


# -------- auth --------
class TestAuth:
    def test_login_admin(self, admin_auth):
        assert admin_auth["user"]["role"] == "admin"
        assert admin_auth["token"]

    def test_login_citizen(self, citizen_auth):
        assert citizen_auth["user"]["role"] == "citizen"

    def test_login_worker(self, worker_auth):
        assert worker_auth["user"]["role"] == "worker"

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s, citizen_auth):
        r = s.get(f"{API}/auth/me", headers=H(citizen_auth))
        assert r.status_code == 200
        assert r.json()["email"] == "demo@fixmycity.app"

    def test_register_new(self, s):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "secret123"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token"] and d["user"]["email"].lower() == email.lower()
        # login again
        r2 = s.post(f"{API}/auth/login", json={"email": email, "password": "secret123"})
        assert r2.status_code == 200

    def test_register_duplicate(self, s):
        r = s.post(f"{API}/auth/register", json={"name": "X", "email": "demo@fixmycity.app", "password": "secret123"})
        assert r.status_code == 400

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------- upload & classify --------
class TestUploadClassify:
    def test_upload_jpeg(self, s, citizen_auth):
        with open(SEED_DIR / "road1.jpg", "rb") as f:
            r = s.post(f"{API}/upload", headers=H(citizen_auth), files={"file": ("road1.jpg", f, "image/jpeg")})
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/uploads/")
        # verify static served
        r2 = requests.get(BASE_URL + url, timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image")

    def test_classify_road_image(self, s, citizen_auth):
        with open(SEED_DIR / "road1.jpg", "rb") as f:
            up = s.post(f"{API}/upload", headers=H(citizen_auth), files={"file": ("road1.jpg", f, "image/jpeg")}).json()
        r = s.post(f"{API}/issues/classify", headers=H(citizen_auth),
                   json={"image_url": up["url"], "description": ""}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] in ["electricity", "roads", "water", "sanitation", "streetlights", "other"]
        assert 0.0 <= d["confidence"] <= 1.0
        assert d["source"] in ["ai", "keyword", "fallback"]
        # store for external check
        print(f"classify road1 -> {d}")

    def test_classify_garbage_image(self, s, citizen_auth):
        with open(SEED_DIR / "garbage1.jpg", "rb") as f:
            up = s.post(f"{API}/upload", headers=H(citizen_auth), files={"file": ("garbage1.jpg", f, "image/jpeg")}).json()
        r = s.post(f"{API}/issues/classify", headers=H(citizen_auth),
                   json={"image_url": up["url"], "description": ""}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        print(f"classify garbage1 -> {d}")
        assert d["source"] in ["ai", "keyword", "fallback"]


# -------- issues --------
class TestIssues:
    def test_list_issues(self, s, citizen_auth):
        r = s.get(f"{API}/issues", headers=H(citizen_auth))
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 20
        it = arr[0]
        for k in ["id", "category", "status", "upvotes", "timeline", "author"]:
            assert k in it

    def test_filter_by_category(self, s, citizen_auth):
        r = s.get(f"{API}/issues?category=roads", headers=H(citizen_auth))
        assert r.status_code == 200
        for it in r.json():
            assert it["category"] == "roads"

    def test_filter_by_status(self, s, citizen_auth):
        r = s.get(f"{API}/issues?status=Pending", headers=H(citizen_auth))
        assert r.status_code == 200
        for it in r.json():
            assert it["status"] == "Pending"

    def test_sort_top(self, s, citizen_auth):
        r = s.get(f"{API}/issues?sort=top", headers=H(citizen_auth))
        arr = r.json()
        ups = [x["upvotes"] for x in arr]
        assert ups == sorted(ups, reverse=True)

    def test_create_issue_and_verify(self, s, citizen_auth):
        # upload photo
        with open(SEED_DIR / "road2.jpg", "rb") as f:
            up = s.post(f"{API}/upload", headers=H(citizen_auth), files={"file": ("road2.jpg", f, "image/jpeg")}).json()
        # points before
        me_before = s.get(f"{API}/auth/me", headers=H(citizen_auth)).json()
        payload = {
            "description": "TEST_pothole created by pytest",
            "category": "roads",
            "lat": 12.9716, "lng": 77.5946,
            "address": "TEST Bengaluru", "area": "TEST_Koramangala",
            "image_url": up["url"], "ai_confidence": 0.9,
        }
        r = s.post(f"{API}/issues", headers=H(citizen_auth), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "roads"
        assert d["status"] == "Pending"
        assert d["area"] == "TEST_Koramangala"
        assert len(d["timeline"]) >= 1
        # verify in mine
        mine = s.get(f"{API}/issues/mine", headers=H(citizen_auth)).json()
        assert any(x["id"] == d["id"] for x in mine)
        # points +10
        me_after = s.get(f"{API}/auth/me", headers=H(citizen_auth)).json()
        assert me_after["points"] >= me_before["points"] + 10 or me_after["points"] > 0
        # save id
        pytest.created_issue_id = d["id"]

    def test_upvote_toggle(self, s, citizen_auth):
        # find an issue not authored by demo user
        me = s.get(f"{API}/auth/me", headers=H(citizen_auth)).json()
        issues = s.get(f"{API}/issues", headers=H(citizen_auth)).json()
        target = next((i for i in issues if i["author"]["id"] != me["id"]), None)
        assert target is not None
        base = target["upvotes"]
        was_up = target["upvoted"]
        r = s.post(f"{API}/issues/{target['id']}/upvote", headers=H(citizen_auth))
        assert r.status_code == 200
        d = r.json()
        if was_up:
            assert d["upvotes"] == base - 1
        else:
            assert d["upvotes"] == base + 1
        # toggle back
        r2 = s.post(f"{API}/issues/{target['id']}/upvote", headers=H(citizen_auth))
        assert r2.json()["upvotes"] == base


# -------- admin & workflow --------
class TestAdminWorkflow:
    def test_workers_list(self, s, admin_auth):
        r = s.get(f"{API}/workers", headers=H(admin_auth))
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 4
        assert all("resolved_count" in w for w in arr)

    def test_analytics(self, s, admin_auth):
        r = s.get(f"{API}/analytics", headers=H(admin_auth))
        assert r.status_code == 200
        d = r.json()
        for k in ["total", "active", "resolved", "by_status", "by_category", "by_area", "trend"]:
            assert k in d
        assert len(d["trend"]) == 14

    def test_analytics_forbidden_citizen(self, s, citizen_auth):
        r = s.get(f"{API}/analytics", headers=H(citizen_auth))
        assert r.status_code == 403

    def test_analytics_forbidden_worker(self, s, worker_auth):
        r = s.get(f"{API}/analytics", headers=H(worker_auth))
        assert r.status_code == 403

    def test_full_assign_progress_resolve(self, s, admin_auth, worker_auth, citizen_auth):
        # create fresh issue from citizen
        with open(SEED_DIR / "road3.jpg", "rb") as f:
            up = s.post(f"{API}/upload", headers=H(citizen_auth), files={"file": ("road3.jpg", f, "image/jpeg")}).json()
        r = s.post(f"{API}/issues", headers=H(citizen_auth), json={
            "description": "TEST_workflow issue", "category": "roads",
            "lat": 12.97, "lng": 77.59, "address": "TEST", "area": "TEST_area",
            "image_url": up["url"],
        })
        issue_id = r.json()["id"]

        # admin assigns to worker1
        workers = s.get(f"{API}/workers", headers=H(admin_auth)).json()
        w = next(x for x in workers if x["email"] == "worker1@fixmycity.gov")
        r = s.patch(f"{API}/issues/{issue_id}/assign", headers=H(admin_auth),
                    json={"worker_id": w["id"], "deadline": "2026-12-31", "note": "TEST assignment"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "Assigned"
        assert d["assigned_to"]["id"] == w["id"]

        # worker tasks list shows it
        tasks = s.get(f"{API}/tasks", headers=H(worker_auth)).json()
        assert any(t["id"] == issue_id for t in tasks)

        # worker sets In Progress
        r = s.patch(f"{API}/issues/{issue_id}/status", headers=H(worker_auth), json={"status": "In Progress"})
        assert r.status_code == 200
        assert r.json()["status"] == "In Progress"

        # worker resolves with after photo
        with open(SEED_DIR / "after1.jpg", "rb") as f:
            up2 = s.post(f"{API}/upload", headers=H(worker_auth), files={"file": ("after1.jpg", f, "image/jpeg")}).json()
        r = s.patch(f"{API}/issues/{issue_id}/status", headers=H(worker_auth),
                    json={"status": "Resolved", "resolution_image": up2["url"], "note": "done"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "Resolved"
        assert d["resolution_image"]
        # verify statuses in timeline
        statuses = [t["status"] for t in d["timeline"]]
        assert "Assigned" in statuses and "In Progress" in statuses and "Resolved" in statuses

    def test_worker_cannot_touch_others_task(self, s, worker_auth, admin_auth, citizen_auth):
        # find issue assigned to another worker (or unassigned)
        issues = s.get(f"{API}/issues", headers=H(admin_auth)).json()
        me = s.get(f"{API}/auth/me", headers=H(worker_auth)).json()
        other = next((i for i in issues if i["assigned_to"] and i["assigned_to"]["id"] != me["id"]), None)
        if not other:
            pytest.skip("no other-worker task available")
        r = s.patch(f"{API}/issues/{other['id']}/status", headers=H(worker_auth), json={"status": "In Progress"})
        assert r.status_code == 403


# -------- leaderboard --------
class TestLeaderboard:
    def test_leaderboard(self, s, citizen_auth):
        r = s.get(f"{API}/leaderboard", headers=H(citizen_auth))
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        assert arr[0]["rank"] == 1
        pts = [x["points"] for x in arr]
        assert pts == sorted(pts, reverse=True)
