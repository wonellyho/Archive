"""회원 탈퇴 DELETE /api/me(M14, #59) 테스트 — db 계층 모킹, 네트워크 없음.

커버: 인증(401)·정상 삭제 순서(데이터→계정)·계정 삭제 실패 시 502 전파·rate limit
+ db.delete_all_owned_rows·db.delete_auth_user 자체의 httpx 응답 처리.
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

from ._http_fakes import FakeAsyncClient, FakeResponse

client = TestClient(app)


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


# ── 인증 게이트 ──


def test_requires_auth():
    """토큰 없이 탈퇴 요청하면 401."""
    assert client.delete("/api/me").status_code == 401


# ── 정상 흐름 ──


def test_deletes_data_before_account(authed, monkeypatch):
    """계정 자체를 지우기 전에 소유 데이터부터 삭제한다(순서 보장)."""
    calls = []

    async def fake_delete_rows(user_id):
        calls.append(("rows", user_id))

    async def fake_delete_auth(user_id):
        calls.append(("auth", user_id))

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 204
    # 계정을 먼저 지우면 이후 소유 데이터를 user_id로 스코프할 근거가 사라지므로
    # 반드시 데이터 삭제 → 계정 삭제 순서여야 한다.
    assert calls == [("rows", "test-user"), ("auth", "test-user")]


# ── 에러 전파 ──


def test_auth_failure_returns_502(authed, monkeypatch):
    """계정 삭제(GoTrue) 단계가 실패하면 502가 그대로 전파된다."""
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        raise HTTPException(502, "계정 삭제 오류 (HTTP 500).")

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 502


def test_missing_service_role_returns_503(authed, monkeypatch):
    """service_role 키 미설정으로 인한 503도 그대로 전파된다."""
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        raise HTTPException(503, "서버에 쓰기용 Supabase 키(service_role)가 설정되지 않았습니다.")

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    resp = client.delete("/api/me")
    assert resp.status_code == 503


# ── rate limit ──


def test_rate_limit_returns_429(authed, monkeypatch):
    """탈퇴 요청도 분당 상한을 넘기면 429."""
    async def fake_delete_rows(user_id):
        return None

    async def fake_delete_auth(user_id):
        return None

    monkeypatch.setattr(db, "delete_all_owned_rows", fake_delete_rows)
    monkeypatch.setattr(db, "delete_auth_user", fake_delete_auth)

    limiter.enabled = True  # 이 테스트만 켠다(conftest는 기본 off)
    n = int(LIMIT_ACCOUNT_DELETE.split("/")[0])

    codes = [client.delete("/api/me").status_code for _ in range(n)]
    assert all(c == 204 for c in codes), f"상한 이내는 모두 204여야 함: {codes}"

    over = client.delete("/api/me")
    assert over.status_code == 429


# ── db.delete_all_owned_rows / db.delete_auth_user 자체 (httpx 모킹) ──


@pytest.fixture
def _service_role_configured():
    """service_role 키 존재 체크를 통과시키기 위한 더미 설정(실 네트워크는 안 감)."""
    settings = get_settings()
    orig_url, orig_key = settings.supabase_url, settings.supabase_service_role_key
    settings.supabase_url = "https://fake.supabase.co"
    settings.supabase_service_role_key = "fake-service-role-key"
    yield
    settings.supabase_url, settings.supabase_service_role_key = orig_url, orig_key


def test_continues_after_one_table_fails(_service_role_configured, monkeypatch):
    """테이블 하나가 실패해도 나머지는 계속 삭제를 시도한다(순차 중단 방지)."""
    called_tables = []

    def responder(method, url, **kwargs):
        table = url.rsplit("/", 1)[-1]
        called_tables.append(table)
        if table == "folders":
            return httpx.ConnectError("boom")
        return FakeResponse(200, {})

    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(responder))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(db.delete_all_owned_rows("test-user"))
    assert exc.value.status_code == 502
    # folders가 실패했어도 contents·saves·profiles 전부 시도됐어야 한다(순차 중단 아님).
    assert set(called_tables) == {"contents", "folders", "saves", "profiles"}


def test_auth_delete_success(_service_role_configured, monkeypatch):
    """GoTrue가 200/204를 주면 예외 없이 성공."""
    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(204)))
    asyncio.run(db.delete_auth_user("test-user"))  # 예외 없이 통과하면 성공


def test_auth_delete_404_is_ok(_service_role_configured, monkeypatch):
    """GoTrue가 404(이미 삭제된 계정)를 반환해도 예외 없이 성공 처리한다(멱등)."""
    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(404)))
    asyncio.run(db.delete_auth_user("test-user"))  # 예외 없이 통과하면 성공


def test_auth_delete_502_on_error(_service_role_configured, monkeypatch):
    """GoTrue가 그 외 비정상 상태코드를 주면 502."""
    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(500)))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db.delete_auth_user("test-user"))
    assert exc.value.status_code == 502
