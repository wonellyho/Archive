"""LLM 호출 공통 가드 — 키 미설정·사용자별 rate limit·월 예산·업스트림 오류 매핑.

`/api/llm/suggest`(M6)와 `/api/contents/{id}/tags/suggest`(M13)가 공유한다.
한쪽만 고치고 다른 쪽을 빠뜨리는 걸 막기 위해 가드 로직을 한곳에 둔다.
"""

from typing import Awaitable, Callable, TypeVar

from fastapi import HTTPException

from ..config import get_settings
from .base import LLMError, LLMRateLimited
from .budget import current_month, get_monthly_budget
from .ratelimit import get_rate_limiter

T = TypeVar("T")


async def run_guarded(
    user_id: str, call: Callable[[], Awaitable[tuple[T, int]]], *, error_message: str
) -> T:
    """4중 방어(키 은닉은 provider 생성 시점, 나머지는 여기)를 적용해 provider를 호출한다.

    call은 (결과, 사용 토큰 수)를 반환하는 코루틴 팩토리. 성공 시 토큰을 월 예산에 반영한다.
    """
    if not get_settings().anthropic_api_key:
        raise HTTPException(503, "서버에 LLM API 키가 설정되지 않았습니다.")
    if not get_rate_limiter().allow(user_id):
        raise HTTPException(429, "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.")

    budget, month = get_monthly_budget(), current_month()
    if budget.exceeded(user_id, month):
        raise HTTPException(429, "이번 달 LLM 사용량 상한을 초과했습니다.")

    try:
        result, tokens = await call()
    except LLMRateLimited:
        raise HTTPException(429, "LLM 사용량이 많습니다. 잠시 후 다시 시도해 주세요.")
    except LLMError:
        raise HTTPException(502, error_message)

    budget.add(user_id, month, tokens)
    return result
