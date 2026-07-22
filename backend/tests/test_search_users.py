"""사용자 검색 API(M10, #54) — 랭킹 단위 + 라우터(모킹)."""

from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.routers.search import rank_users

client = TestClient(app)


# ── 랭킹 로직(단위) ──


def test_rank_users_matches_username_or_name():
    """검색어가 username 또는 name 어디에 있어도 매치된다."""
    candidates = [
        {"username": "wonho", "name": "최원호"},
        {"username": "junghoon", "name": "wonho fan"},  # name에만 포함
        {"username": "someone", "name": "no match"},
    ]
    result = rank_users("wonho", candidates)
    assert {r["username"] for r in result} == {"wonho", "junghoon"}


def test_rank_users_case_insensitive():
    """대소문자를 구분하지 않는다."""
    candidates = [{"username": "WonHo", "name": ""}]
    assert rank_users("wonho", candidates) == candidates


def test_rank_users_prefix_match_ranked_first():
    """username이 검색어로 시작하는 후보가 그렇지 않은 후보보다 앞에 온다."""
    candidates = [
        {"username": "new_wonho", "name": ""},  # 포함되지만 시작은 아님
        {"username": "wonho_official", "name": ""},  # 시작 일치
    ]
    result = rank_users("wonho", candidates)
    assert [r["username"] for r in result] == ["wonho_official", "new_wonho"]


def test_rank_users_respects_limit():
    """limit을 넘는 결과는 잘라낸다."""
    candidates = [{"username": f"user{i}", "name": ""} for i in range(30)]
    assert len(rank_users("user", candidates, limit=5)) == 5


def test_rank_users_no_match_returns_empty():
    """부분 일치가 하나도 없으면 빈 리스트."""
    candidates = [{"username": "wonho", "name": ""}]
    assert rank_users("zzz", candidates) == []


def test_rank_users_blank_query_returns_empty():
    """공백만 있는 검색어는 strip 후 빈 문자열이 되는데, 빈 문자열을 그대로
    쓰면 모든 후보가 매치돼버려 사실상 전체 유저 목록이 노출된다 — 그 대신
    빈 결과를 반환해야 한다."""
    candidates = [{"username": "wonho", "name": ""}, {"username": "junghoon", "name": ""}]
    assert rank_users("   ", candidates) == []


# ── 라우터 ──


def test_search_returns_matching_users(monkeypatch):
    """정상 검색은 200 + camelCase 목록을 반환한다(인증 불필요)."""

    async def fake_fetch():
        return [
            {"username": "wonho", "name": "최원호"},
            {"username": "junghoon", "name": "하정훈"},
        ]

    monkeypatch.setattr(db, "fetch_searchable_users", fake_fetch)
    resp = client.get("/api/search/users", params={"q": "wonho"})
    assert resp.status_code == 200
    data = resp.json()
    assert data == [{"username": "wonho", "name": "최원호"}]


def test_search_no_match_returns_empty_list(monkeypatch):
    """일치하는 사용자가 없으면 404가 아니라 빈 배열(공개 목록 조회이므로)."""

    async def fake_fetch():
        return [{"username": "wonho", "name": ""}]

    monkeypatch.setattr(db, "fetch_searchable_users", fake_fetch)
    resp = client.get("/api/search/users", params={"q": "nobody"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_query_too_short_returns_422():
    """빈 검색어(q="")는 min_length=1 위반으로 422."""
    resp = client.get("/api/search/users", params={"q": ""})
    assert resp.status_code == 422


def test_search_missing_query_returns_422():
    """q 파라미터 자체가 없으면 422(필수 파라미터)."""
    resp = client.get("/api/search/users")
    assert resp.status_code == 422


def test_search_whitespace_query_returns_empty_not_all_users(monkeypatch):
    """공백 하나(" ")는 min_length=1 자체는 통과하지만, strip 후 빈 문자열이
    되어 전체 유저가 새어나가면 안 되고 빈 배열을 반환해야 한다."""

    async def fake_fetch():
        return [{"username": "wonho", "name": ""}, {"username": "junghoon", "name": ""}]

    monkeypatch.setattr(db, "fetch_searchable_users", fake_fetch)
    resp = client.get("/api/search/users", params={"q": " "})
    assert resp.status_code == 200
    assert resp.json() == []
