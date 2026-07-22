"""헬스체크 + 루트 엔드포인트 — 지금까지 어디서도 직접 검증된 적이 없었다."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    """서버가 살아있으면 /health가 200 + {status: ok}를 반환한다."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_root_returns_service_info():
    """루트 경로는 서비스 식별 정보(Swagger 링크 포함)를 반환한다."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "archive-backend"
    assert data["docs"] == "/docs"
