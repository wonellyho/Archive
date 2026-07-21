"""db.py의 핵심 저수준 함수(_select·_write·_credentials·_write_credentials) 단위 테스트.

거의 모든 db.py 함수(fetch_profile·upsert_profile·add_save 등)가 이 네 함수를
거쳐가는데, 기존 테스트들은 그 상위 함수들을 통째로 모킹해서 써서 정작 이
저수준 함수들 자체의 httpx 응답 처리(성공·네트워크 오류·비정상 상태코드)는
검증된 적이 없었다.
"""

import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app import db
from app.config import get_settings

from ._http_fakes import FakeAsyncClient, FakeResponse


@pytest.fixture
def configured():
    """Supabase 접속 정보가 설정된 상태로 만드는 픽스처(실 네트워크는 안 감)."""
    settings = get_settings()
    orig = (
        settings.supabase_url,
        settings.supabase_anon_key,
        settings.supabase_service_role_key,
    )
    settings.supabase_url = "https://fake.supabase.co"
    settings.supabase_anon_key = "fake-anon-key"
    settings.supabase_service_role_key = "fake-service-role-key"
    yield
    (
        settings.supabase_url,
        settings.supabase_anon_key,
        settings.supabase_service_role_key,
    ) = orig


# ── _credentials / _write_credentials ──


def test_credentials_missing_url_returns_503(configured):
    settings = get_settings()
    settings.supabase_url = ""
    with pytest.raises(HTTPException) as exc:
        db._credentials()
    assert exc.value.status_code == 503


def test_credentials_prefers_service_role_over_anon(configured):
    base, key = db._credentials()
    assert base == "https://fake.supabase.co/rest/v1"
    assert key == "fake-service-role-key"


def test_write_credentials_missing_key_returns_503(configured):
    settings = get_settings()
    settings.supabase_service_role_key = ""
    with pytest.raises(HTTPException) as exc:
        db._write_credentials()
    assert exc.value.status_code == 503


# ── _select ──


def test_select_success_returns_json(configured, monkeypatch):
    rows = [{"id": "1"}]
    monkeypatch.setattr(
        db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(200, rows))
    )
    result = asyncio.run(db._select("base", "key", "profiles", {}))
    assert result == rows


def test_select_network_error_returns_502(configured, monkeypatch):
    def responder(method, url, **kwargs):
        return httpx.ConnectError("boom")

    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(responder))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db._select("base", "key", "profiles", {}))
    assert exc.value.status_code == 502


def test_select_non_200_returns_502(configured, monkeypatch):
    monkeypatch.setattr(
        db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(500))
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db._select("base", "key", "profiles", {}))
    assert exc.value.status_code == 502


# ── _write ──


def test_write_success_returns_json(configured, monkeypatch):
    monkeypatch.setattr(
        db,
        "get_client",
        lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(201, {"id": "1"})),
    )
    result = asyncio.run(db._write("POST", "folders", json={"name": "x"}))
    assert result == {"id": "1"}


def test_write_empty_response_returns_none(configured, monkeypatch):
    """204 No Content처럼 본문이 없는 응답은 None을 반환해야 한다."""
    monkeypatch.setattr(
        db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(204))
    )
    result = asyncio.run(db._write("PATCH", "folders", json={}))
    assert result is None


def test_write_conflict_returns_409(configured, monkeypatch):
    monkeypatch.setattr(
        db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(409))
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db._write("POST", "folders", json={}))
    assert exc.value.status_code == 409


def test_write_server_error_returns_502(configured, monkeypatch):
    monkeypatch.setattr(
        db, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(500))
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db._write("POST", "folders", json={}))
    assert exc.value.status_code == 502


def test_write_network_error_returns_502(configured, monkeypatch):
    def responder(method, url, **kwargs):
        return httpx.ConnectError("boom")

    monkeypatch.setattr(db, "get_client", lambda: FakeAsyncClient(responder))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(db._write("POST", "folders", json={}))
    assert exc.value.status_code == 502
