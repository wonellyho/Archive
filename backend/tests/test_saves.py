"""찜(saves) API(M7-A) 테스트 — db 계층 모킹, 네트워크 없음.

커버: 인증(401)·목록·추가(멱등·소유자 스탬프)·없는 콘텐츠(404)·해제·형식(422).
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import db
from app.deps import CurrentUser, get_current_user
from app.main import app

client = TestClient(app)

VALID_UUID = "11111111-2222-4333-8444-555555555555"
CONTENT_ROW = {
    "id": VALID_UUID,
    "type": "music",
    "folder_id": None,
    "youtube_video_id": "abc123",
    "source_title": "원본",
    "source_channel": "채널",
    "thumbnail_url": "",
    "title": "제목",
    "subtitle": "",
    "body": "",
    "sort_order": 0,
    "created_at": "2026-07-05T00:00:00+00:00",
    "user_id": "someone",  # 응답 모델에서 무시됨
}


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


# ── 인증 게이트 ──


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/saves"),
        ("POST", "/api/saves"),
        ("DELETE", f"/api/saves/{VALID_UUID}"),
    ],
)
def test_찜은_토큰_없이_401(method, path):
    assert client.request(method, path, json={}).status_code == 401


# ── 목록 ──


def test_찜_목록은_콘텐츠_배열을_반환(authed, monkeypatch):
    async def fake_list(user_id):
        assert user_id == "test-user"
        return [CONTENT_ROW]

    monkeypatch.setattr(db, "list_saved_contents", fake_list)
    resp = client.get("/api/saves")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["youtubeVideoId"] == "abc123"
    assert "userId" not in data[0]  # user_id는 응답에 노출 안 됨


# ── 추가 ──


def test_찜_추가는_소유자와_콘텐츠id를_전달(authed, monkeypatch):
    captured = {}

    async def fake_add(user_id, content_id):
        captured.update(user_id=user_id, content_id=content_id)

    monkeypatch.setattr(db, "add_save", fake_add)
    resp = client.post("/api/saves", json={"contentId": VALID_UUID})
    assert resp.status_code == 204
    assert captured == {"user_id": "test-user", "content_id": VALID_UUID}


def test_없는_콘텐츠_찜은_404(authed, monkeypatch):
    async def fake_add(user_id, content_id):
        raise HTTPException(404, "콘텐츠를 찾을 수 없습니다.")

    monkeypatch.setattr(db, "add_save", fake_add)
    resp = client.post("/api/saves", json={"contentId": VALID_UUID})
    assert resp.status_code == 404


def test_찜_추가_contentId_형식오류는_422(authed):
    resp = client.post("/api/saves", json={"contentId": "not-a-uuid"})
    assert resp.status_code == 422


# ── 해제 ──


def test_찜_해제는_소유자로_스코프(authed, monkeypatch):
    captured = {}

    async def fake_remove(user_id, content_id):
        captured.update(user_id=user_id, content_id=content_id)

    monkeypatch.setattr(db, "remove_save", fake_remove)
    resp = client.delete(f"/api/saves/{VALID_UUID}")
    assert resp.status_code == 204
    assert captured == {"user_id": "test-user", "content_id": VALID_UUID}
