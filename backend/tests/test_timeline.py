"""취향 타임라인 API(M8-A) — 집계 단위 테스트 + 라우터(모킹)."""

from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.routers.timeline import build_timeline

client = TestClient(app)


# ── 집계 로직(단위) ──


def test_build_timeline_월별_집계_정렬():
    rows = [
        {"created_at": "2026-07-02T00:00:00+00:00", "type": "music"},
        {"created_at": "2026-06-29T05:33:33+00:00", "type": "music"},
        {"created_at": "2026-06-15T00:00:00+00:00", "type": "video"},
        {"created_at": "2026-07-01T00:00:00+00:00", "type": "music"},
    ]
    buckets = build_timeline(rows)
    assert [b.period for b in buckets] == ["2026-06", "2026-07"]  # 오름차순
    assert buckets[0].total == 2 and buckets[0].music == 1 and buckets[0].video == 1
    assert buckets[1].total == 2 and buckets[1].music == 2 and buckets[1].video == 0


def test_build_timeline_불량행은_무시():
    rows = [
        {"created_at": "bad", "type": "music"},        # 기간 파싱 불가
        {"created_at": "2026-07-01T00:00:00", "type": "other"},  # 타입 무효
        {"created_at": None, "type": "music"},         # created_at 없음
        {"created_at": "2026-07-02T00:00:00", "type": "video"},
    ]
    buckets = build_timeline(rows)
    assert len(buckets) == 1
    assert buckets[0].period == "2026-07" and buckets[0].total == 1 and buckets[0].video == 1


# ── 라우터 ──


def test_타임라인_200(monkeypatch):
    async def fake(username):
        assert username == "wonho"  # 대문자 입력이 소문자로 조회
        return [{"created_at": "2026-07-01T00:00:00+00:00", "type": "music"}]

    monkeypatch.setattr(db, "fetch_timeline_rows", fake)
    resp = client.get("/api/timeline/WonHo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "wonho"
    assert data["buckets"][0]["period"] == "2026-07"
    assert data["buckets"][0]["total"] == 1 and data["buckets"][0]["music"] == 1


def test_콘텐츠_없어도_유저있으면_빈버킷_200(monkeypatch):
    async def fake(username):
        return []  # 유저 존재, 콘텐츠 없음

    monkeypatch.setattr(db, "fetch_timeline_rows", fake)
    resp = client.get("/api/timeline/empty")
    assert resp.status_code == 200
    assert resp.json()["buckets"] == []


def test_없는_username은_404(monkeypatch):
    async def fake(username):
        return None

    monkeypatch.setattr(db, "fetch_timeline_rows", fake)
    assert client.get("/api/timeline/nobody").status_code == 404
