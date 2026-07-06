"""LLM 월 토큰 예산(기능7·8 ②) — 사용자별 1개월 누적 토큰 상한.

in-memory(프로세스 로컬). 다중 워커/재시작 영속은 배포 시 DB/Redis로 이관(후속).
per-user rate limit(분당)과 별개의 '비용' 방어 계층.
"""

from datetime import datetime, timezone


def current_month() -> str:
    """현재 연-월(UTC, 'YYYY-MM')."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


class MonthlyTokenBudget:
    """(user_id, month)별 누적 토큰. 상한 이상이면 초과로 판단한다."""

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._usage: dict[tuple[str, str], int] = {}

    def exceeded(self, user_id: str, month: str) -> bool:
        """이미 상한 이상 사용했으면 True."""
        return self._usage.get((user_id, month), 0) >= self._limit

    def add(self, user_id: str, month: str, tokens: int) -> None:
        """사용 토큰을 누적한다."""
        key = (user_id, month)
        self._usage[key] = self._usage.get(key, 0) + max(0, tokens)

    def used(self, user_id: str, month: str) -> int:
        return self._usage.get((user_id, month), 0)

    def reset(self) -> None:
        """테스트/재설정용."""
        self._usage.clear()


_budget: MonthlyTokenBudget | None = None


def get_monthly_budget() -> MonthlyTokenBudget:
    """설정값 기반 월 토큰 예산 싱글턴."""
    global _budget
    if _budget is None:
        from ..config import get_settings

        _budget = MonthlyTokenBudget(get_settings().llm_monthly_token_budget)
    return _budget
