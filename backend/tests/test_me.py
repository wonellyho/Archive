"""내 프로필 조회 GET /api/me — db 모킹, 네트워크 없음."""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.deps import CurrentUser, get_current_user
from app.main import app

client = TestClient(app)


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


def test_requires_auth():
    assert client.get("/api/me").status_code == 401


def test_returns_own_profile(authed, monkeypatch):
    async def fake(user_id):
        assert user_id == "test-user"  # 토큰 sub 기준 조회
        return {
            "id": "me",
            "user_id": "test-user",
            "name": "메이도브",
            "tagline": "나의 비망록",
            "bio": "",
            "keywords": ["종강"],
            "profile_image_url": None,
            "username": "maydove",
        }

    monkeypatch.setattr(db, "fetch_profile", fake)
    resp = client.get("/api/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "메이도브"
    assert data["username"] == "maydove"
    assert data["keywords"] == ["종강"]
    assert "userId" not in data  # user_id는 응답에 노출 안 됨


def test_returns_default_when_missing(authed, monkeypatch):
    async def fake(user_id):
        return None  # 신규 사용자

    monkeypatch.setattr(db, "fetch_profile", fake)
    resp = client.get("/api/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Archive"  # default_profile
    assert data["username"] is None
