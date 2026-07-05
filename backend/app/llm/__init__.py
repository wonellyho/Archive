"""LLM 문구추천(M6). provider를 얇은 어댑터로 추상화한다.

교체 지점: `get_provider()`가 반환하는 구현체만 바꾸면 provider가 바뀐다.
현재 구현 = Anthropic Claude Haiku 4.5 (`docs/기술결정_LLM_provider.md`).
"""

from functools import lru_cache

from .base import LLMError, LLMProvider, LLMRateLimited


@lru_cache
def get_provider() -> LLMProvider:
    """설정에 따라 LLM provider 인스턴스를 반환(프로세스당 1회 생성)."""
    # 지연 임포트: anthropic SDK는 실제 사용할 때만 로드.
    from ..config import get_settings
    from .anthropic_provider import AnthropicProvider

    s = get_settings()
    return AnthropicProvider(
        api_key=s.anthropic_api_key, model=s.llm_model, max_tokens=s.llm_max_tokens
    )


__all__ = ["get_provider", "LLMProvider", "LLMError", "LLMRateLimited"]
