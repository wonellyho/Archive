"""bootstrap 엔드포인트 단위 테스트 — db 계층을 모킹해 네트워크 없이 검증한다."""

from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)

FOLDER_ROW = {
    "id": "f1",
    "type": "music",
    "name": "새벽 감성",
    "cover_image_url": None,
    "sort_order": 0,
    "created_at": "2026-06-29T05:33:33.226+00:00",
}
CONTENT_ROW = {
    "id": "c1",
    "type": "video",
    "folder_id": None,
    "youtube_video_id": "abc123",
    "source_title": "원본 제목",
    "source_channel": "채널",
    "thumbnail_url": "https://example.com/t.jpg",
    "title": "내가 붙인 제목",
    "subtitle": "",
    "body": "",
    "sort_order": 0,
    "created_at": "2026-06-29T05:33:33.226+00:00",
}


def _mock_fetch(profile_row, folder_rows, content_rows):
    async def fake():
        return profile_row, folder_rows, content_rows

    return fake


def test_bootstrap_은_camelCase_RepoData_형태로_응답한다(monkeypatch):
    profile_row = {
        "id": "me",
        "name": "개발중",
        "tagline": "한 줄",
        "bio": "소개",
        "keywords": ["종강"],
        "profile_image_url": None,
    }
    monkeypatch.setattr(
        db, "fetch_bootstrap", _mock_fetch(profile_row, [FOLDER_ROW], [CONTENT_ROW])
    )

    resp = client.get("/api/bootstrap")
    assert resp.status_code == 200
    data = resp.json()

    # 프론트 RepoData와 동일한 키(camelCase)
    assert sorted(data.keys()) == [
        "musicContents",
        "musicFolders",
        "profile",
        "videoContents",
        "videoFolders",
    ]
    assert data["profile"]["name"] == "개발중"
    # type별 분류
    assert len(data["musicFolders"]) == 1 and len(data["videoFolders"]) == 0
    assert len(data["videoContents"]) == 1 and len(data["musicContents"]) == 0
    # snake_case → camelCase 변환 + created_at 문자열 그대로 통과
    folder = data["musicFolders"][0]
    assert folder["coverImageUrl"] is None
    assert folder["sortOrder"] == 0
    assert folder["createdAt"] == "2026-06-29T05:33:33.226+00:00"
    content = data["videoContents"][0]
    assert content["youtubeVideoId"] == "abc123"
    assert content["folderId"] is None


def test_bootstrap_은_프로필_행이_없으면_기본_프로필을_준다(monkeypatch):
    monkeypatch.setattr(db, "fetch_bootstrap", _mock_fetch(None, [], []))

    resp = client.get("/api/bootstrap")
    assert resp.status_code == 200
    profile = resp.json()["profile"]
    # 프론트 storageService.ts defaultProfile 과 동일
    assert profile["name"] == "My Archive"
    assert profile["tagline"] == "Things I keep returning to."
    assert profile["keywords"] == []


def test_youtube_검색은_토큰_없이_401(monkeypatch):
    resp = client.get("/api/youtube/search", params={"q": "테스트", "type": "music"})
    assert resp.status_code == 401
