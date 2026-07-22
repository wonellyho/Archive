"""Anthropic provider(app/llm/anthropic_provider.py) 단위 테스트 — SDK 호출 모킹.

다른 LLM 테스트(test_llm.py 등)는 FakeProvider로 대체해서 쓰기 때문에,
실제 Claude API를 감싸는 이 provider 자체(성공 응답 파싱·예외 매핑)는
그동안 검증된 적이 없었다.
"""

import asyncio
from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import LLMError, LLMRateLimited
from app.schemas import SuggestIn

SUGGEST_IN = SuggestIn(type="music", source_title="곡", source_channel="채널")


def _provider():
    return AnthropicProvider(api_key="fake-key", model="claude-haiku-4-5", max_tokens=400)


def _fake_message(text, input_tokens=10, output_tokens=5):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


def _mock_create(monkeypatch, provider, result_or_error):
    async def fake_create(**kwargs):
        if isinstance(result_or_error, BaseException):
            raise result_or_error
        return result_or_error

    monkeypatch.setattr(provider._client.messages, "create", fake_create)


def _fake_response(status_code):
    return httpx.Response(status_code, request=httpx.Request("POST", "https://api.anthropic.com"))


# ── 성공 ──


def test_suggest_returns_parsed_result_and_token_count(monkeypatch):
    """정상 응답이면 파싱된 SuggestResult와 (input+output) 토큰 합계를 반환한다."""
    provider = _provider()
    _mock_create(monkeypatch, provider, _fake_message('{"taglines": ["a"], "mood": "b"}'))

    result, tokens = asyncio.run(provider.suggest(SUGGEST_IN))
    assert result.taglines == ["a"] and result.mood == "b"
    assert tokens == 15  # input 10 + output 5


# ── 예외 매핑 ──


def test_rate_limit_error_raises_llm_rate_limited(monkeypatch):
    """SDK의 RateLimitError는 LLMRateLimited로 변환된다."""
    provider = _provider()
    error = anthropic.RateLimitError("rate limited", response=_fake_response(429), body=None)
    _mock_create(monkeypatch, provider, error)
    with pytest.raises(LLMRateLimited):
        asyncio.run(provider.suggest(SUGGEST_IN))


def test_status_429_raises_llm_rate_limited(monkeypatch):
    """RateLimitError가 아니어도 상태코드가 429면 동일하게 LLMRateLimited로 처리한다."""
    provider = _provider()
    error = anthropic.APIStatusError("busy", response=_fake_response(429), body=None)
    _mock_create(monkeypatch, provider, error)
    with pytest.raises(LLMRateLimited):
        asyncio.run(provider.suggest(SUGGEST_IN))


def test_other_status_error_raises_llm_error(monkeypatch):
    """429가 아닌 업스트림 상태 오류는 일반 LLMError로 변환한다(상세 사유는 로그에만 남김)."""
    provider = _provider()
    error = anthropic.APIStatusError("boom", response=_fake_response(500), body=None)
    _mock_create(monkeypatch, provider, error)
    with pytest.raises(LLMError):
        asyncio.run(provider.suggest(SUGGEST_IN))


def test_connection_error_raises_llm_error(monkeypatch):
    """연결 자체가 실패(APIConnectionError)해도 LLMError로 변환한다."""
    provider = _provider()
    error = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com"))
    _mock_create(monkeypatch, provider, error)
    with pytest.raises(LLMError):
        asyncio.run(provider.suggest(SUGGEST_IN))
