"""사용자별 in-memory rate limit(보안 4계층 중 'rate limit').

단일 프로세스 기준 슬라이딩 윈도우. 다중 워커/배포 확장 시 M5에서
slowapi + 공유 저장소(Redis 등)로 교체 예정.
"""

import time
from collections import defaultdict, deque


class RateLimiter:
    """key(사용자 id)별 window_sec 내 max_calls 회로 제한한다."""

    def __init__(self, max_calls: int, window_sec: float) -> None:
        self._max = max_calls
        self._win = window_sec
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        """호출을 허용하면 True(카운트 반영), 초과면 False."""
        now = time.monotonic() if now is None else now
        dq = self._hits[key]
        cutoff = now - self._win
        while dq and dq[0] <= cutoff:
            dq.popleft()
        if len(dq) >= self._max:
            return False
        dq.append(now)
        return True

    def reset(self) -> None:
        """테스트/재설정용 — 모든 카운트 초기화."""
        self._hits.clear()


_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    """설정값 기반 rate limiter 싱글턴."""
    global _limiter
    if _limiter is None:
        from ..config import get_settings

        _limiter = RateLimiter(
            max_calls=get_settings().llm_rate_per_min, window_sec=60.0
        )
    return _limiter
