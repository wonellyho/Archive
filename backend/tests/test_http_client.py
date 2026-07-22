"""공유 HTTP 클라이언트(app/http.py) 단위 테스트.

다른 모든 테스트는 get_client()를 호출 지점에서 통째로 모킹해서 쓰기 때문에,
실제 싱글턴 생성·재사용·종료 로직은 여기서 직접 검증한다. 실 네트워크 요청은
하지 않는다(httpx.AsyncClient 생성·종료 자체는 네트워크를 타지 않음).
"""

import asyncio

import httpx
import pytest

from app import http


@pytest.fixture(autouse=True)
def _reset_client():
    """다른 테스트로 전역 싱글턴 상태가 새지 않도록 앞뒤로 정리."""
    asyncio.run(http.close_client())
    yield
    asyncio.run(http.close_client())


def test_get_client_returns_same_instance_on_reuse():
    """get_client()를 여러 번 불러도 같은 인스턴스를 재사용한다(매번 새로 안 만듦)."""
    first = http.get_client()
    second = http.get_client()
    assert first is second
    assert isinstance(first, httpx.AsyncClient)


def test_close_client_allows_fresh_instance_afterward():
    """close_client() 후에는 다음 get_client() 호출이 새 인스턴스를 만든다."""
    first = http.get_client()
    asyncio.run(http.close_client())
    second = http.get_client()
    assert first is not second


def test_close_client_twice_is_safe():
    """이미 닫힌 상태에서 다시 닫아도 에러 없이 무해하다."""
    http.get_client()
    asyncio.run(http.close_client())
    asyncio.run(http.close_client())  # 이미 닫힌 상태에서 다시 호출해도 에러 없어야 함
