"""Tests for account deletion DELETE /api/me (M14, #59) — db layer mocked, no network.

Covers: auth gate (401) - deletion order (data before account) - 502/503 propagation
- rate limit + direct httpx response handling in db.delete_all_owned_rows /
db.delete_auth_user (regression coverage for code-review findings).
"""

import asyncio

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import db
from app.config import get_settings
from app.deps import CurrentUser, get_current_user
from app.limiter import LIMIT_ACCOUNT_DELETE, limiter
from app.main import app

client = TestClient(app)


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


# ── auth gate ──


def test_delete_without_token_returns_401():
    assert client.delete("/api/me").status_code == 401


# ── happy path ──


def test_delete_calls_owned_data_deletion_before_auth_deletion(authed, monkeypatch):
    calls = []

    async def fake_delete_rows(user_id):
        calls.append(("rows", user_id))

    async def fake_delete_auth(user_id):
        calls.append(("auth", user_id))

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 204
    # Deleting the auth account first would remove the only basis for scoping
    # owned data by user_id, so data deletion must always happen first.
    assert calls == [("rows", "test-user"), ("auth", "test-user")]


# ── error propagation ──


def test_auth_deletion_failure_returns_502(authed, monkeypatch):
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        raise HTTPException(502, "계정 삭제 오류 (HTTP 500).")

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 502


def test_missing_service_role_returns_503(authed, monkeypatch):
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        raise HTTPException(503, "서버에 쓰기용 Supabase 키(service_role)가 설정되지 않았습니다.")

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 503


# ── rate limit ──


def test_rate_limit_exceeded_returns_429(authed, monkeypatch):
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        return None

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    limiter.enabled = True  # only this test turns it on (conftest defaults to off)
    n = int(LIMIT_ACCOUNT_DELETE.split("/")[0])

    codes = [client.delete("/api/me").status_code for _ in range(n)]
    assert all(c == 204 for c in codes), f"all requests within the limit should be 204: {codes}"

    over = client.delete("/api/me")
    assert over.status_code == 429


# ── db.delete_all_owned_rows / db.delete_auth_user directly (httpx mocked) ──


class _FakeResponse:
    def __init__(self, status_code: int, body: object = None):
        self.status_code = status_code
        self.content = b"{}" if body is not None else b""

    def json(self):
        return {}


class _FakeClient:
    """Minimal stand-in for the httpx.AsyncClient returned by get_client().

    `_write` calls `.request(method, url, params=, json=, headers=)`,
    `delete_auth_user` calls `.delete(url, headers=)`.
    """

    def __init__(self, responder):
        self._responder = responder  # (method, url) -> _FakeResponse | Exception

    async def request(self, method, url, **_kwargs):
        result = self._responder(method, url)
        if isinstance(result, Exception):
            raise result
        return result

    async def delete(self, url, **_kwargs):
        return self._responder("DELETE", url)


@pytest.fixture
def _service_role_configured():
    """Dummy settings so the service_role presence check passes (no real network)."""
    settings = get_settings()
    orig_url, orig_key = settings.supabase_url, settings.supabase_service_role_key
    settings.supabase_url = "https://fake.supabase.co"
    settings.supabase_service_role_key = "fake-service-role-key"
    yield
    settings.supabase_url, settings.supabase_service_role_key = orig_url, orig_key


def test_delete_all_owned_rows_attempts_all_tables_even_if_one_fails(
    _service_role_configured, monkeypatch
):
    """Confirms asyncio.gather(return_exceptions=True) — regression guard for code-review finding #1."""
    called_tables = []

    def responder(method, url):
        table = url.rsplit("/", 1)[-1]
        called_tables.append(table)
        if table == "folders":
            return httpx.ConnectError("boom")
        return _FakeResponse(200, {})

    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(responder))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(db.delete_all_owned_rows("test-user"))
    assert exc.value.status_code == 502
    # folders failed, but contents/saves/profiles should still all have been
    # attempted (no short-circuit on first failure).
    assert set(called_tables) == {"contents", "folders", "saves", "profiles"}


def test_delete_auth_user_succeeds_without_exception(_service_role_configured, monkeypatch):
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(204)))
    asyncio.run(db.delete_auth_user("test-user"))  # no exception raised == success


def test_delete_auth_user_treats_404_as_already_deleted(_service_role_configured, monkeypatch):
    """GoTrue returning 404 on retry (idempotent) — regression guard for code-review finding #2."""
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(404)))
    asyncio.run(db.delete_auth_user("test-user"))  # no exception raised == success


def test_delete_auth_user_other_status_codes_return_502(_service_role_configured, monkeypatch):
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(500)))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db.delete_auth_user("test-user"))
    assert exc.value.status_code == 502
