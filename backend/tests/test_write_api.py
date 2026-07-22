"""쓰기 API(profile·folders·contents) 단위 테스트 — db 계층 모킹, 네트워크 없음."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import db
from app.deps import CurrentUser, get_current_user
from app.main import app

client = TestClient(app)

VALID_UUID = "11111111-2222-4333-8444-555555555555"
FOLDER_ROW = {
    "id": VALID_UUID,
    "type": "music",
    "name": "새 폴더",
    "cover_image_url": None,
    "sort_order": 5,
    "created_at": "2026-07-05T00:00:00+00:00",
}
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
    "sort_order": 3,
    "created_at": "2026-07-05T00:00:00+00:00",
}


@pytest.fixture
def authed():
    """인증 통과 상태로 만드는 픽스처."""
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


# ── 인증 게이트: 모든 쓰기는 토큰 없이 401 ──


@pytest.mark.parametrize(
    "method,path",
    [
        ("PUT", "/api/profile"),
        ("POST", "/api/folders"),
        ("PATCH", f"/api/folders/{VALID_UUID}"),
        ("DELETE", f"/api/folders/{VALID_UUID}"),
        ("POST", "/api/contents"),
        ("PATCH", f"/api/contents/{VALID_UUID}"),
        ("DELETE", f"/api/contents/{VALID_UUID}"),
    ],
)
def test_requires_auth(method, path):
    resp = client.request(method, path, json={})
    assert resp.status_code == 401


# ── 프로필 ──


def test_profile_save_forwards_to_upsert(authed, monkeypatch):
    captured = {}

    async def fake_upsert(fields, user_id, username=None):
        captured.update(fields)
        captured["_user_id"] = user_id
        captured["_username"] = username

    monkeypatch.setattr(db, "upsert_profile", fake_upsert)
    resp = client.put(
        "/api/profile",
        json={
            "name": "정훈",
            "tagline": "한 줄",
            "bio": "",
            "keywords": ["보안"],
            "username": "JungHoon_01",
        },
    )
    assert resp.status_code == 204
    assert captured["name"] == "정훈"
    assert captured["keywords"] == ["보안"]
    assert captured["profile_image_url"] is None
    assert captured["_user_id"] == "test-user"  # 소유자 스탬프
    assert captured["_username"] == "junghoon_01"  # 소문자 정규화


def test_profile_name_too_long_returns_422(authed):
    resp = client.put("/api/profile", json={"name": "가" * 101})
    assert resp.status_code == 422


# ── 폴더 ──


def test_folder_create_computes_sort_order(authed, monkeypatch):
    inserted = {}

    async def fake_next(table, content_type, user_id):
        assert (table, content_type, user_id) == ("folders", "music", "test-user")
        return 5

    async def fake_insert(table, row):
        inserted.update(row)
        return FOLDER_ROW

    monkeypatch.setattr(db, "next_sort_order", fake_next)
    monkeypatch.setattr(db, "insert_row", fake_insert)

    resp = client.post(
        "/api/folders", json={"id": VALID_UUID, "type": "music", "name": "새 폴더"}
    )
    assert resp.status_code == 201
    assert inserted["sort_order"] == 5  # 서버 계산값
    assert inserted["user_id"] == "test-user"  # 소유자 스탬프
    data = resp.json()
    assert data["sortOrder"] == 5 and data["createdAt"]  # camelCase + 서버 발급


def test_folder_create_invalid_uuid_returns_422(authed):
    resp = client.post(
        "/api/folders", json={"id": "id-123-abc", "type": "music", "name": "x"}
    )
    assert resp.status_code == 422


def test_folder_patch_distinguishes_null_from_absent(authed, monkeypatch):
    calls = []

    async def fake_patch(table, row_id, fields, user_id):
        calls.append((fields, user_id))

    monkeypatch.setattr(db, "patch_row", fake_patch)

    # coverImageUrl: null → 커버 제거(cover_image_url=None 포함되어야 함)
    resp = client.patch(f"/api/folders/{VALID_UUID}", json={"coverImageUrl": None})
    assert resp.status_code == 204
    assert calls[-1] == ({"cover_image_url": None}, "test-user")  # 소유자 스코프

    # 필드 없음 → cover_image_url이 포함되지 않아야 함
    resp = client.patch(f"/api/folders/{VALID_UUID}", json={"name": "이름만"})
    assert calls[-1] == ({"name": "이름만"}, "test-user")


def test_folder_patch_empty_body_skips_db(authed, monkeypatch):
    async def fail_patch(*a):
        raise AssertionError("호출되면 안 됨")

    monkeypatch.setattr(db, "patch_row", fail_patch)
    resp = client.patch(f"/api/folders/{VALID_UUID}", json={})
    assert resp.status_code == 204


def test_folder_delete_cascades_contents_first(authed, monkeypatch):
    order = []

    async def fake_delete(table, column, value, user_id):
        order.append((table, column, value, user_id))

    monkeypatch.setattr(db, "delete_rows", fake_delete)
    resp = client.delete(f"/api/folders/{VALID_UUID}")
    assert resp.status_code == 204
    assert order == [
        ("contents", "folder_id", VALID_UUID, "test-user"),
        ("folders", "id", VALID_UUID, "test-user"),
    ]


# ── 콘텐츠 ──


def test_content_create_success(authed, monkeypatch):
    async def fake_next(table, content_type, user_id):
        return 3

    async def fake_insert(table, row):
        assert row["youtube_video_id"] == "abc123"
        assert row["user_id"] == "test-user"  # 소유자 스탬프
        return CONTENT_ROW

    monkeypatch.setattr(db, "next_sort_order", fake_next)
    monkeypatch.setattr(db, "insert_row", fake_insert)
    resp = client.post(
        "/api/contents",
        json={
            "id": VALID_UUID,
            "type": "music",
            "folderId": None,
            "youtubeVideoId": "abc123",
            "title": "제목",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["youtubeVideoId"] == "abc123"


def test_content_create_duplicate_id_returns_409(authed, monkeypatch):
    async def fake_next(table, content_type, user_id):
        return 0

    async def fake_insert(table, row):
        raise HTTPException(409, "중복 ID이거나 참조(폴더)가 유효하지 않습니다.")

    monkeypatch.setattr(db, "next_sort_order", fake_next)
    monkeypatch.setattr(db, "insert_row", fake_insert)
    resp = client.post(
        "/api/contents",
        json={"id": VALID_UUID, "type": "music", "youtubeVideoId": "abc123"},
    )
    assert resp.status_code == 409


def test_content_body_too_long_returns_422(authed):
    resp = client.post(
        "/api/contents",
        json={
            "id": VALID_UUID,
            "type": "music",
            "youtubeVideoId": "abc123",
            "body": "가" * 2001,
        },
    )
    assert resp.status_code == 422


def test_content_patch_forwards_only_sent_fields(authed, monkeypatch):
    """PATCH로 보낸 필드만 그대로 db.patch_row에 전달된다."""
    calls = []

    async def fake_patch(table, row_id, fields, user_id):
        calls.append((table, row_id, fields, user_id))

    monkeypatch.setattr(db, "patch_row", fake_patch)
    resp = client.patch(f"/api/contents/{VALID_UUID}", json={"title": "새 제목"})
    assert resp.status_code == 204
    assert calls == [("contents", VALID_UUID, {"title": "새 제목"}, "test-user")]


def test_content_patch_empty_body_skips_db(authed, monkeypatch):
    """빈 본문으로 PATCH하면 DB 호출 없이 204만 반환한다."""
    async def fail_patch(*a):
        raise AssertionError("호출되면 안 됨")

    monkeypatch.setattr(db, "patch_row", fail_patch)
    resp = client.patch(f"/api/contents/{VALID_UUID}", json={})
    assert resp.status_code == 204


def test_content_delete_scoped_to_owner(authed, monkeypatch):
    """콘텐츠 삭제는 본인 소유로 스코프해서 db.delete_rows를 호출한다."""
    calls = []

    async def fake_delete(table, column, value, user_id):
        calls.append((table, column, value, user_id))

    monkeypatch.setattr(db, "delete_rows", fake_delete)
    resp = client.delete(f"/api/contents/{VALID_UUID}")
    assert resp.status_code == 204
    assert calls == [("contents", "id", VALID_UUID, "test-user")]
