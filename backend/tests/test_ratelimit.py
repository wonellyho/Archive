"""M5: rate limit(slowapi) + 보안 헤더 테스트.

기본적으로 conftest가 limiter를 꺼두므로, rate limit 테스트만 명시적으로 켠다.
보안 헤더는 limiter와 무관하게 모든 응답에 적용됨을 확인한다.
"""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.limiter import LIMIT_BOOTSTRAP, limiter
from app.main import app

client = TestClient(app)


@pytest.fixture
def mock_bootstrap(monkeypatch):
    """bootstrap DB 조회를 네트워크 없이 빈 결과로 모킹."""

    async def fake_fetch():
        return ({}, [], [])

    monkeypatch.setattr(db, "fetch_bootstrap", fake_fetch)


# ── rate limit ──


def test_bootstrap_limit_returns_429(mock_bootstrap):
    limiter.enabled = True  # 이 테스트만 켠다(conftest는 기본 off)
    n = int(LIMIT_BOOTSTRAP.split("/")[0])

    codes = [client.get("/api/bootstrap").status_code for _ in range(n)]
    assert all(c == 200 for c in codes), f"상한 이내는 모두 200이어야 함: {codes}"

    over = client.get("/api/bootstrap")  # n+1번째
    assert over.status_code == 429
    assert over.json()["detail"] == "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."


# ── 보안 헤더 ──


def test_security_headers_present(mock_bootstrap):
    resp = client.get("/api/bootstrap")
    assert resp.status_code == 200
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["referrer-policy"] == "no-referrer"
    assert resp.headers["cross-origin-resource-policy"] == "same-origin"
    assert "default-src 'none'" in resp.headers["content-security-policy"]


def test_docs_excluded_from_csp():
    resp = client.get("/docs")
    assert resp.status_code == 200  # Swagger UI 정상
    assert "content-security-policy" not in resp.headers  # CSP 제외
    assert resp.headers["x-content-type-options"] == "nosniff"  # 다른 헤더는 유지


def test_no_hsts_outside_production(mock_bootstrap):
    # 개발 기본값(ENVIRONMENT!=production)에서는 HSTS를 붙이지 않는다.
    resp = client.get("/api/bootstrap")
    assert "strict-transport-security" not in resp.headers
