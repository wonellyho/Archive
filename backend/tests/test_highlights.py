"""하이라이트 API(M12, #56) 테스트 — db 계층 모킹, 네트워크 없음.

커버: 목록(공개, 인증 불필요)·등록(소유자 검증·개수 제한 409·경합 409 메시지)·
수정(스코프 전달·명시적 null 거부)·삭제(스코프 전달)·형식(422)·인증 게이트(쓰기 3종만 401).
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import db
from app.deps import CurrentUser, get_current_user
from app.main import app

client = TestClient(app)

VALID_CONTENT_ID = "11111111-2222-4333-8444-555555555555"
VALID_HIGHLIGHT_ID = "66666666-7777-4888-8999-000000000000"
HIGHLIGHT_ROW = {
    "id": VALID_HIGHLIGHT_ID,
    "content_id": VALID_CONTENT_ID,
    "timestamp_seconds": 42,
    "comment": "이 부분 좋다",
    "created_at": "2026-07-22T00:00:00+00:00",
}


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


# ── 인증 게이트 (쓰기만 필요) ──


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", f"/api/contents/{VALID_CONTENT_ID}/highlights"),
        ("PATCH", f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}"),
        ("DELETE", f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}"),
    ],
)
def test_write_requires_auth(method, path):
    assert client.request(method, path, json={}).status_code == 401


def test_list_does_not_require_auth(monkeypatch):
    """목록 조회는 방문자도 가능(공개 API) — 토큰 없이도 200."""
    monkeypatch.setattr(db, "list_highlights", lambda content_id: _async([]))
    resp = client.get(f"/api/contents/{VALID_CONTENT_ID}/highlights")
    assert resp.status_code == 200
    assert resp.json() == []


# ── 목록 ──


def test_list_returns_highlights(monkeypatch):
    monkeypatch.setattr(db, "list_highlights", lambda content_id: _async([HIGHLIGHT_ROW]))
    resp = client.get(f"/api/contents/{VALID_CONTENT_ID}/highlights")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["timestampSeconds"] == 42
    assert data[0]["comment"] == "이 부분 좋다"


# ── 등록 ──


def test_create_rejects_non_owner(authed, monkeypatch):
    """콘텐츠 소유자가 아니면 403 — 하이라이트를 만들지 않는다."""
    monkeypatch.setattr(db, "content_owner_id", lambda content_id: _async("someone-else"))
    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": 10, "comment": "좋다"},
    )
    assert resp.status_code == 403


def test_create_missing_content_returns_404(authed, monkeypatch):
    monkeypatch.setattr(db, "content_owner_id", lambda content_id: _async(None))
    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": 10, "comment": "좋다"},
    )
    assert resp.status_code == 404


def test_create_over_limit_returns_409(authed, monkeypatch):
    """콘텐츠당 개수 제한(현재 1개)을 넘으면 409."""
    monkeypatch.setattr(db, "content_owner_id", lambda content_id: _async("test-user"))
    monkeypatch.setattr(db, "list_highlights", lambda content_id: _async([HIGHLIGHT_ROW]))
    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": 10, "comment": "좋다"},
    )
    assert resp.status_code == 409


def test_create_success_stamps_owner(authed, monkeypatch):
    captured = {}

    async def fake_insert(table, row):
        captured.update(table=table, row=row)
        return HIGHLIGHT_ROW

    monkeypatch.setattr(db, "content_owner_id", lambda content_id: _async("test-user"))
    monkeypatch.setattr(db, "list_highlights", lambda content_id: _async([]))
    monkeypatch.setattr(db, "insert_row", fake_insert)

    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": 42, "comment": "이 부분 좋다"},
    )
    assert resp.status_code == 201
    assert captured["table"] == "highlights"
    assert captured["row"]["user_id"] == "test-user"
    assert captured["row"]["content_id"] == VALID_CONTENT_ID


def test_create_invalid_body_returns_422(authed):
    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": -1, "comment": ""},
    )
    assert resp.status_code == 422


def test_create_insert_conflict_returns_highlight_specific_409(authed, monkeypatch):
    """사전 확인(len(existing)) 통과 후 삽입 시점에 경합(DB 유니크 제약)으로 409가 나면,
    db._write의 범용 '폴더 참조' 문구가 아니라 하이라이트 맥락의 메시지로 바뀐다."""

    async def fake_insert(table, row):
        raise HTTPException(409, "중복 ID이거나 참조(폴더)가 유효하지 않습니다.")

    monkeypatch.setattr(db, "content_owner_id", lambda content_id: _async("test-user"))
    monkeypatch.setattr(db, "list_highlights", lambda content_id: _async([]))
    monkeypatch.setattr(db, "insert_row", fake_insert)

    resp = client.post(
        f"/api/contents/{VALID_CONTENT_ID}/highlights",
        json={"timestampSeconds": 10, "comment": "좋다"},
    )
    assert resp.status_code == 409
    assert "폴더" not in resp.json()["detail"]


# ── 수정 ──


def test_update_passes_full_scope(authed, monkeypatch):
    """content_id는 db.patch_row의 extra로, highlight_id·user_id는 기본 인자로 전달한다
    (교차 스코프 방지 — URL의 content_id와 실제 소속이 달라도 0행으로 무시됨)."""
    captured = {}

    async def fake_patch(table, row_id, fields, user_id, *, extra=None):
        captured.update(table=table, row_id=row_id, fields=fields, user_id=user_id, extra=extra)

    monkeypatch.setattr(db, "patch_row", fake_patch)
    resp = client.patch(
        f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}",
        json={"comment": "수정됨"},
    )
    assert resp.status_code == 204
    assert captured == {
        "table": "highlights",
        "row_id": VALID_HIGHLIGHT_ID,
        "fields": {"comment": "수정됨"},
        "user_id": "test-user",
        "extra": {"content_id": f"eq.{VALID_CONTENT_ID}"},
    }


def test_update_empty_body_skips_db_call(authed, monkeypatch):
    """보낸 필드가 없으면 db 호출 없이 그대로 204(다른 라우터의 exclude_unset 관례와 동일)."""
    called = False

    async def fake_patch(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(db, "patch_row", fake_patch)
    resp = client.patch(
        f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}", json={}
    )
    assert resp.status_code == 204
    assert called is False


@pytest.mark.parametrize("field", ["timestampSeconds", "comment"])
def test_update_rejects_explicit_null(authed, field):
    """comment·timestampSeconds는 DB에서 not null이라 명시적 null은 422로 거부한다
    (필드 생략은 변경 안 함이지만, null은 다른 컬럼의 '제거' 관례와 달리 허용 안 함)."""
    resp = client.patch(
        f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}",
        json={field: None},
    )
    assert resp.status_code == 422


# ── 삭제 ──


def test_delete_passes_full_scope(authed, monkeypatch):
    captured = {}

    async def fake_delete(table, column, value, user_id, *, extra=None):
        captured.update(table=table, column=column, value=value, user_id=user_id, extra=extra)

    monkeypatch.setattr(db, "delete_rows", fake_delete)
    resp = client.delete(f"/api/contents/{VALID_CONTENT_ID}/highlights/{VALID_HIGHLIGHT_ID}")
    assert resp.status_code == 204
    assert captured == {
        "table": "highlights",
        "column": "id",
        "value": VALID_HIGHLIGHT_ID,
        "user_id": "test-user",
        "extra": {"content_id": f"eq.{VALID_CONTENT_ID}"},
    }


async def _async(value):
    return value
