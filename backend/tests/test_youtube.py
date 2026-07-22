"""YouTube 검색 프록시 회귀 테스트.

M5에서 rate limit 데코레이터 + request 파라미터를 추가했으므로,
인증 게이트·입력 검증이 그대로 동작하는지(시그니처 파손 없음) 확인한다.
"""

import httpx
import pytest
from fastapi.testclient import TestClient

from app import config
from app.deps import CurrentUser, get_current_user
from app.main import app
from app.routers import youtube

from ._http_fakes import FakeAsyncClient, FakeResponse

client = TestClient(app)


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


def test_requires_auth():
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 401


def test_query_too_short_returns_422(authed):
    # 인증 우회 없이도 쿼리 검증(min_length=2)이 먼저 걸리는지와 무관하게,
    # 토큰이 없으면 401이 우선한다 → 인증을 통과시켜 검증만 확인.
    resp = client.get("/api/youtube/search", params={"q": "a"})
    assert resp.status_code == 422


# ── 검색 본문(httpx 모킹) — 성공 응답 매핑·업스트림 에러 분기 ──

_YOUTUBE_RESPONSE = {
    "items": [
        {
            "id": {"videoId": "abc123"},
            "snippet": {
                "title": "IU - 밤편지",
                "channelTitle": "1theK",
                "thumbnails": {"medium": {"url": "https://i.ytimg.com/vi/abc123/mqdefault.jpg"}},
            },
        },
        {"id": {}, "snippet": {}},  # videoId 없는 항목은 건너뛴다
    ]
}


@pytest.fixture
def youtube_key_configured():
    settings = config.get_settings()
    orig = settings.youtube_api_key
    settings.youtube_api_key = "fake-key"
    yield
    settings.youtube_api_key = orig


def test_missing_key_returns_503(authed):
    """YOUTUBE_API_KEY가 없으면 503."""
    settings = config.get_settings()
    orig = settings.youtube_api_key
    settings.youtube_api_key = ""
    try:
        resp = client.get("/api/youtube/search", params={"q": "iu"})
        assert resp.status_code == 503
    finally:
        settings.youtube_api_key = orig


def test_search_maps_snippet_to_result_fields(authed, youtube_key_configured, monkeypatch):
    """YouTube 응답 snippet을 프론트 타입 필드로 매핑하고, videoId 없는 항목은 건너뛴다."""
    monkeypatch.setattr(
        youtube,
        "get_client",
        lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(200, _YOUTUBE_RESPONSE)),
    )
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1  # videoId 없는 항목은 제외됨
    assert data[0]["youtubeVideoId"] == "abc123"
    assert data[0]["channelTitle"] == "1theK"


def test_search_forwards_music_category_filter(authed, youtube_key_configured, monkeypatch):
    """type=music이면 videoCategoryId=10을 업스트림 요청에 실어 보낸다."""
    captured = {}

    def responder(method, url, **kwargs):
        captured.update(kwargs.get("params"))
        return FakeResponse(200, {"items": []})

    monkeypatch.setattr(youtube, "get_client", lambda: FakeAsyncClient(responder))
    client.get("/api/youtube/search", params={"q": "iu", "type": "music"})
    assert captured["videoCategoryId"] == "10"


def test_search_upstream_403_returns_429(authed, youtube_key_configured, monkeypatch):
    """YouTube가 403(할당량 초과 등)을 주면 429로 변환한다."""
    monkeypatch.setattr(
        youtube, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(403))
    )
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 429


def test_search_upstream_error_returns_502(authed, youtube_key_configured, monkeypatch):
    """그 외 비정상 상태코드는 502로 처리한다."""
    monkeypatch.setattr(
        youtube, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(500))
    )
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 502


def test_search_network_error_returns_502(authed, youtube_key_configured, monkeypatch):
    """요청 자체가 네트워크 오류로 실패해도 502."""
    def responder(method, url, **kwargs):
        return httpx.ConnectError("boom")

    monkeypatch.setattr(youtube, "get_client", lambda: FakeAsyncClient(responder))
    resp = client.get("/api/youtube/search", params={"q": "iu"})
    assert resp.status_code == 502
