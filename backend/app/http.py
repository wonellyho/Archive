"""공유 HTTP 클라이언트.

요청마다 httpx.AsyncClient를 새로 만들면 TLS 핸드셰이크·커넥션 풀이 매번
생성되므로, 앱 전체가 하나의 클라이언트를 재사용한다. 종료는 main.py의
lifespan에서 처리한다.

주의: 클라이언트는 최초 사용 시점의 이벤트 루프에 바인딩된다.
- 프로덕션(uvicorn)은 단일 루프라 문제 없음.
- 테스트에서 실제 네트워크를 여러 번 호출할 때는 반드시
  `with TestClient(app) as c:` (컨텍스트 매니저)로 단일 루프를 유지할 것.
  요청마다 루프가 새로 생기면 "Event loop is closed"가 발생한다.
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
