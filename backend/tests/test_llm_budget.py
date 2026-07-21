"""LLM 월 토큰 예산(G3) — 단위 + 라우터(모킹)."""

import pytest
from fastapi.testclient import TestClient

from app.deps import CurrentUser, get_current_user
from app.llm.budget import MonthlyTokenBudget, get_monthly_budget
from app.main import app
from app.schemas import SuggestResult

client = TestClient(app)
VALID = {"type": "music", "sourceTitle": "곡"}


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


class FakeProv:
    def __init__(self, tokens):
        self.tokens = tokens
        self.calls = 0

    async def suggest(self, data):
        self.calls += 1
        return SuggestResult(taglines=["a"], mood="b"), self.tokens


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr("app.routers.llm.get_provider", lambda: provider)


# ── 단위 ──


def test_budget_accumulates_and_detects_exceeded():
    b = MonthlyTokenBudget(limit=100)
    m = "2026-07"
    assert not b.exceeded("u", m)
    b.add("u", m, 60)
    assert not b.exceeded("u", m)
    b.add("u", m, 40)  # 누적 100 >= 100
    assert b.exceeded("u", m)
    assert b.used("u", m) == 100
    b.add("other", m, 10)  # 사용자별 독립
    assert b.used("u", m) == 100


# ── 라우터 ──


def test_monthly_budget_exceeded_returns_429(authed, monkeypatch):
    fake = FakeProv(tokens=100)
    _use_provider(monkeypatch, fake)
    get_monthly_budget()._limit = 100  # 1회(100) 통과 후 누적 100 → 다음은 초과

    assert client.post("/api/llm/suggest", json=VALID).status_code == 200
    assert client.post("/api/llm/suggest", json=VALID).status_code == 429
    assert fake.calls == 1  # 초과 후 provider까지 가지 않음
