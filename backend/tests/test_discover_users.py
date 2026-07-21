"""유저-유저 취향 유사도(G6) — 랭킹 단위 + 라우터(모킹)."""

from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.routers.discover import rank_similar_users

client = TestClient(app)


# ── 랭킹 로직(단위) ──


def test_rank_similar_users_scores_shared_channels_and_keywords():
    ref = {"channels": ["A", "B"], "keywords": ["k1", "k2"]}
    others = [
        {"username": "alice", "channels": ["A"], "keywords": ["k1"]},   # 2+2=4
        {"username": "bob", "channels": ["A", "B"], "keywords": []},    # 4+0=4
        {"username": "carol", "channels": ["Z"], "keywords": ["z"]},    # 0 → 제외
    ]
    ranked = rank_similar_users(ref, others)
    assert {u.username for u in ranked} == {"alice", "bob"}  # carol 제외
    assert all(u.score == 4 for u in ranked)
    alice = next(u for u in ranked if u.username == "alice")
    assert alice.shared_channels == ["A"] and alice.shared_keywords == ["k1"]


def test_rank_similar_users_empty_when_no_overlap():
    ref = {"channels": ["A"], "keywords": ["k"]}
    others = [{"username": "x", "channels": ["Z"], "keywords": ["y"]}]
    assert rank_similar_users(ref, others) == []


# ── 라우터 ──


def test_similar_users_returns_200(monkeypatch):
    ref = {"username": "me", "channels": ["A"], "keywords": ["k"]}
    others = [{"username": "friend", "channels": ["A"], "keywords": ["k"]}]

    async def fake(username):
        assert username == "me"  # 대문자 입력이 소문자로 조회
        return (ref, others)

    monkeypatch.setattr(db, "fetch_user_taste_pool", fake)
    resp = client.get("/api/discover/users/ME")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["username"] == "friend" and data[0]["score"] == 4
    assert data[0]["sharedChannels"] == ["A"] and data[0]["sharedKeywords"] == ["k"]


def test_missing_user_returns_404(monkeypatch):
    async def fake(username):
        return None

    monkeypatch.setattr(db, "fetch_user_taste_pool", fake)
    assert client.get("/api/discover/users/nobody").status_code == 404
