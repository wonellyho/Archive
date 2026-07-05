"""유사 콘텐츠 추천 API(M8-B) — 랭킹 단위 + 라우터(모킹)."""

from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.routers.discover import rank_similar

client = TestClient(app)


# ── 랭킹 로직(단위) ──


def test_rank_similar_채널가중_타입가중_자기제외():
    target = {"id": "t", "type": "music", "source_channel": "A"}
    candidates = [
        {"id": "t", "type": "music", "source_channel": "A"},   # 자기 자신 → 제외
        {"id": "c1", "type": "music", "source_channel": "A"},  # 채널+타입 = 3
        {"id": "c2", "type": "music", "source_channel": "B"},  # 타입 = 1
        {"id": "c3", "type": "video", "source_channel": "A"},  # 채널 = 2
        {"id": "c4", "type": "video", "source_channel": "B"},  # 0 → 제외
    ]
    ranked = rank_similar(target, candidates)
    assert [r["id"] for r in ranked] == ["c1", "c3", "c2"]  # 3 > 2 > 1, 0은 빠짐


def test_rank_similar_동점은_최신순():
    target = {"id": "t", "type": "music", "source_channel": "A"}
    candidates = [
        {"id": "old", "type": "music", "source_channel": "B", "created_at": "2026-06-01"},
        {"id": "new", "type": "music", "source_channel": "B", "created_at": "2026-07-01"},
    ]
    ranked = rank_similar(target, candidates)
    assert [r["id"] for r in ranked] == ["new", "old"]  # 동점(타입=1) → 최신 우선


def test_rank_similar_limit():
    target = {"id": "t", "type": "music", "source_channel": "A"}
    candidates = [
        {"id": f"c{i}", "type": "music", "source_channel": "A", "created_at": f"2026-07-{i:02d}"}
        for i in range(1, 20)
    ]
    assert len(rank_similar(target, candidates, limit=5)) == 5


# ── 라우터 ──

_C = {
    "id": "22222222-2222-4333-8444-555555555555",
    "type": "music",
    "folder_id": None,
    "youtube_video_id": "abc",
    "source_title": "곡",
    "source_channel": "A",
    "thumbnail_url": "",
    "title": "",
    "subtitle": "",
    "body": "",
    "sort_order": 0,
    "created_at": "2026-07-01T00:00:00+00:00",
    "user_id": "u1",
}


def test_유사추천_200(monkeypatch):
    target = {"id": "t", "type": "music", "source_channel": "A"}

    async def fake(content_id):
        assert content_id == "t"
        return (target, [_C])

    monkeypatch.setattr(db, "fetch_similar_pool", fake)
    resp = client.get("/api/discover/similar/t")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["youtubeVideoId"] == "abc"
    assert "userId" not in data[0]  # 응답에 user_id 비노출


def test_없는_콘텐츠는_404(monkeypatch):
    async def fake(content_id):
        return None

    monkeypatch.setattr(db, "fetch_similar_pool", fake)
    assert client.get("/api/discover/similar/nope").status_code == 404
