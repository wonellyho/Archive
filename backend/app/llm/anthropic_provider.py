"""Anthropic Claude(Haiku 4.5) provider 구현.

provider 교체 시 이 파일만 대체하면 된다(계약 = base.LLMProvider).
"""

import logging

import anthropic

from ..schemas import SuggestIn, SuggestResult
from .base import LLMError, LLMRateLimited, build_messages, parse_result

logger = logging.getLogger(__name__)


class AnthropicProvider:
    """Claude Messages API로 문구를 추천한다."""

    def __init__(self, api_key: str, model: str, max_tokens: int) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model
        self._max_tokens = max_tokens

    async def suggest(self, data: SuggestIn) -> SuggestResult:
        system, user = build_messages(data)
        try:
            message = await self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,  # 토큰 예산(비용·남용 상한)
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.RateLimitError:
            raise LLMRateLimited("LLM 사용량이 많습니다.")
        except anthropic.APIStatusError as exc:
            if exc.status_code == 429:
                raise LLMRateLimited("LLM 사용량이 많습니다.")
            # 상태코드만 로깅(키·본문 등 민감정보 비노출).
            logger.warning("Anthropic API 오류: status=%s", exc.status_code)
            raise LLMError("LLM 업스트림 오류입니다.")
        except anthropic.APIError:
            logger.warning("Anthropic API 연결/응답 오류")
            raise LLMError("LLM 요청에 실패했습니다.")

        return parse_result(_extract_text(message))


def _extract_text(message: "anthropic.types.Message") -> str:
    """응답 블록에서 text만 이어붙인다."""
    parts = [
        block.text
        for block in message.content
        if getattr(block, "type", None) == "text"
    ]
    return "".join(parts)
