"""M2-B(#17): 백엔드 쓰기 소유권 검증 — 프로필 소유권 경로.

service_role은 RLS를 우회하므로 백엔드가 직접 소유권을 강제한다.
폴더/콘텐츠의 user_id 스탬프·스코프는 test_write_api.py에서 검증한다.
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
    # 실제 Supabase 접속 정보(env)에 의존하지 않도록 고정.
    monkeypatch.setattr(db, "_credentials", lambda: ("http://db", "key"))


def test_비소유자_프로필_수정은_403(authed, monkeypatch):
    async def fake_select(base, key, table, params):
        return [{"user_id": "someone-else"}]  # 다른 사용자 소유

    called = {"write": False}

    async def fake_write(*a, **k):
        called["write"] = True

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "탈취 시도"})
    assert resp.status_code == 403
    assert called["write"] is False  # 쓰기까지 가지 않음


def test_소유자_프로필_저장은_user_id를_스탬프한다(authed, monkeypatch):
    async def fake_select(base, key, table, params):
        return [{"user_id": "test-user"}]  # 본인 소유

    captured = {}

    async def fake_write(method, table, *, params=None, json=None, prefer=None):
        captured.update(json)

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "정훈"})
    assert resp.status_code == 204
    assert captured["id"] == "me"
    assert captured["user_id"] == "test-user"
    assert captured["name"] == "정훈"


def test_프로필_없으면_현재_사용자를_소유자로_생성(authed, monkeypatch):
    async def fake_select(base, key, table, params):
        return []  # 아직 프로필 없음(전환기)

    captured = {}

    async def fake_write(method, table, *, params=None, json=None, prefer=None):
        captured.update(json)

    monkeypatch.setattr(db, "_select", fake_select)
    monkeypatch.setattr(db, "_write", fake_write)

    resp = client.put("/api/profile", json={"name": "새 프로필"})
    assert resp.status_code == 204
    assert captured["user_id"] == "test-user"
