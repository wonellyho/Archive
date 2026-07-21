"""YouTube 검색 프록시 회귀 테스트.

M5에서 rate limit 데코레이터 + request 파라미터를 추가했으므로,
인증 게이트·입력 검증이 그대로 동작하는지(시그니처 파손 없음) 확인한다.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_requires_auth():
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 401


def test_query_too_short_returns_422():
    # 인증 우회 없이도 쿼리 검증(min_length=2)이 먼저 걸리는지와 무관하게,
    # 토큰이 없으면 401이 우선한다 → 인증을 통과시켜 검증만 확인.
    from app.deps import CurrentUser, get_current_user

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="t")
    try:
        resp = client.get("/api/youtube/search", params={"q": "a"})
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.clear()
