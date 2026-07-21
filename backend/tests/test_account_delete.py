"""회원 탈퇴 DELETE /api/me(M14, #59) 테스트 — db 계층 모킹, 네트워크 없음.

커버: 인증(401)·정상 삭제 순서(데이터→계정)·계정 삭제 실패 시 502 전파·rate limit
+ db.delete_all_owned_rows·db.delete_auth_user 자체의 httpx 응답 처리(코드리뷰 지적 반영).
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


# ── 인증 게이트 ──


def test_delete_without_token_returns_401():
    assert client.delete("/api/me").status_code == 401


# ── 정상 흐름 ──


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
    # 계정을 먼저 지우면 이후 소유 데이터를 user_id로 스코프할 근거가 사라지므로
    # 반드시 데이터 삭제 → 계정 삭제 순서여야 한다.
    assert calls == [("rows", "test-user"), ("auth", "test-user")]


# ── 에러 전파 ──


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

    limiter.enabled = True  # 이 테스트만 켠다(conftest는 기본 off)
    n = int(LIMIT_ACCOUNT_DELETE.split("/")[0])

    codes = [client.delete("/api/me").status_code for _ in range(n)]
    assert all(c == 204 for c in codes), f"상한 이내는 모두 204여야 함: {codes}"

    over = client.delete("/api/me")
    assert over.status_code == 429


# ── db.delete_all_owned_rows / db.delete_auth_user 자체 (httpx 모킹) ──


class _FakeResponse:
    def __init__(self, status_code: int, body: object = None):
        self.status_code = status_code
        self.content = b"{}" if body is not None else b""

    def json(self):
        return {}


class _FakeClient:
    """`get_client()`가 반환하는 httpx.AsyncClient를 대체하는 최소 이중.

    `_write`는 `.request(method, url, params=, json=, headers=)`를,
    `delete_auth_user`는 `.delete(url, headers=)`를 호출한다.
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
    """service_role 키 존재 체크를 통과시키기 위한 더미 설정(실 네트워크는 안 감)."""
    settings = get_settings()
    orig_url, orig_key = settings.supabase_url, settings.supabase_service_role_key
    settings.supabase_url = "https://fake.supabase.co"
    settings.supabase_service_role_key = "fake-service-role-key"
    yield
    settings.supabase_url, settings.supabase_service_role_key = orig_url, orig_key


def test_delete_all_owned_rows_attempts_all_tables_even_if_one_fails(
    _service_role_configured, monkeypatch
):
    """asyncio.gather(return_exceptions=True) 적용 확인 — 코드리뷰 CONFIRMED #1 재발 방지."""
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
    # folders가 실패했어도 contents·saves·profiles 전부 시도됐어야 한다(순차 중단 아님).
    assert set(called_tables) == {"contents", "folders", "saves", "profiles"}


def test_delete_auth_user_succeeds_without_exception(_service_role_configured, monkeypatch):
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(204)))
    asyncio.run(db.delete_auth_user("test-user"))  # 예외 없이 통과하면 성공


def test_delete_auth_user_treats_404_as_already_deleted(_service_role_configured, monkeypatch):
    """재시도 시 GoTrue가 404를 주는 경우(멱등) — 코드리뷰 CONFIRMED #2 재발 방지."""
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(404)))
    asyncio.run(db.delete_auth_user("test-user"))  # 예외 없이 통과하면 성공


def test_delete_auth_user_other_status_codes_return_502(_service_role_configured, monkeypatch):
    monkeypatch.setattr(db, "get_client", lambda: _FakeClient(lambda m, u: _FakeResponse(500)))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db.delete_auth_user("test-user"))
    assert exc.value.status_code == 502
