"""공유 HTTP 클라이언트.

요청마다 httpx.AsyncClient를 새로 만들면 TLS 핸드셰이크·커넥션 풀이 매번
생성되므로, 앱 전체가 하나의 클라이언트를 재사용한다. 종료는 main.py의
lifespan에서 처리한다.
"""

import httpx

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
