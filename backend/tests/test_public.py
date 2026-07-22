"""공개 아카이브 /api/u/{username} (M7-B) — db 모킹, 네트워크 없음."""

from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)

PROFILE_ROW = {
    "id": "me",
    "user_id": "u1",
    "name": "원호",
    "tagline": "t",
    "bio": "",
    "keywords": ["a"],
    "profile_image_url": None,
    "username": "wonho",
}
FOLDER_ROW = {
    "id": "11111111-2222-4333-8444-555555555555",
    "type": "music",
    "name": "새벽",
    "cover_image_url": None,
    "sort_order": 0,
    "created_at": "2026-07-05T00:00:00+00:00",
    "user_id": "u1",
}
CONTENT_ROW = {
    "id": "22222222-2222-4333-8444-555555555555",
    "type": "music",
    "folder_id": None,
    "youtube_video_id": "abc",
    "sort_order": 0,
    "created_at": "2026-07-05T00:00:00+00:00",
    "user_id": "u1",
}


def test_public_archive_returns_200_bootstrap_shape(monkeypatch):
    async def fake(username):
        assert username == "wonho"  # 대문자 입력이 소문자로 조회됨
        return (PROFILE_ROW, [FOLDER_ROW], [CONTENT_ROW])

    monkeypatch.setattr(db, "fetch_public_archive", fake)
    resp = client.get("/api/u/WonHo")  # 대문자로 호출
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["username"] == "wonho"
    assert data["profile"]["name"] == "원호"
    assert data["musicFolders"][0]["name"] == "새벽"
    assert data["musicContents"][0]["youtubeVideoId"] == "abc"


def test_missing_username_returns_404(monkeypatch):
    async def fake(username):
        return None

    monkeypatch.setattr(db, "fetch_public_archive", fake)
    assert client.get("/api/u/nobody").status_code == 404


def test_public_endpoint_needs_no_auth(monkeypatch):
    async def fake(username):
        return None

    monkeypatch.setattr(db, "fetch_public_archive", fake)
    # 토큰 없이도 401이 아니라 404(공개 엔드포인트)
    resp = client.get("/api/u/anything")
    assert resp.status_code == 404
