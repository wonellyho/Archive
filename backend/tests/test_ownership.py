"""M2/M7-B: 프로필 쓰기 소유권 + username 검증.

M7-B에서 프로필은 유저별(1인 1행)로 바뀌었다. on_conflict=user_id 이므로
항상 '본인 행'만 대상이라 별도 403 검사가 필요 없다(소유권 내재).
username은 스키마에서 형식·예약어 검증되고, 타 사용자 중복은 db에서 409.
"""

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


@pytest.fixture(autouse=True)
def _fake_creds(monkeypatch):
    monkeypatch.setattr(db, "_credentials", lambda: ("http://db", "key"))


def test_save_upserts_by_user_id_without_id(authed, monkeypatch):
    calls = {"select": 0}
    captured = {}

    async def fake_select(base, key, table, params):
        calls["select"] += 1
        return []

    async def fake_write(method, table, *, params=None, json=None, prefer=None):
        captured.update(params=params, json=json)

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "정훈"})  # username 없음
    assert resp.status_code == 204
    assert captured["json"]["user_id"] == "test-user"  # 소유자 스탬프
    assert "id" not in captured["json"]  # id는 안 보냄(신규=DB기본값, 기존=유지)
    assert captured["params"] == {"on_conflict": "user_id"}
    assert calls["select"] == 0  # username 없으면 중복확인 select 생략


def test_duplicate_username_returns_409_without_write(authed, monkeypatch):
    async def fake_select(base, key, table, params):
        return [{"user_id": "someone-else"}]  # 다른 유저가 사용 중

    called = {"write": False}

    async def fake_write(*a, **k):
        called["write"] = True

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "x", "username": "taken"})
    assert resp.status_code == 409
    assert called["write"] is False


def test_own_username_saves_successfully(authed, monkeypatch):
    async def fake_select(base, key, table, params):
        return [{"user_id": "test-user"}]  # 본인 소유

    captured = {}

    async def fake_write(method, table, *, params=None, json=None, prefer=None):
        captured.update(json=json)

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "x", "username": "Mine_01"})
    assert resp.status_code == 204
    assert captured["json"]["username"] == "mine_01"  # 소문자 정규화


@pytest.mark.parametrize(
    "username",
    ["me", "ab", "has space", "UPPER!", "a" * 31, "admin", "u"],
)
def test_invalid_username_returns_422(authed, username):
    resp = client.put("/api/profile", json={"name": "x", "username": username})
    assert resp.status_code == 422


@pytest.mark.parametrize("username", [None, "   "])
def test_blank_or_null_username_normalizes_to_none(username):
    """username이 None이거나 공백만 있으면 '미설정'으로 간주해 None으로 정규화된다."""
    from app.schemas import ProfileIn

    assert ProfileIn(name="x", username=username).username is None
