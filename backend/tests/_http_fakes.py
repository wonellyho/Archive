"""`get_client()`가 반환하는 httpx.AsyncClient를 대체하는 범용 테스트 더블.

파일명이 `test_`로 시작하지 않아 pytest가 테스트 모듈로 수집하지 않는다.
db.py·storage.py·youtube 라우터처럼 get_client()를 직접 호출하는 코드를
네트워크 없이 검증할 때 여러 테스트 파일에서 공용으로 가져다 쓴다.
"""


class FakeResponse:
    def __init__(self, status_code: int, json_data: object = None):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.content = b"{}" if json_data is not None else b""

    def json(self):
        return self._json_data


class FakeAsyncClient:
    """responder(method, url, **kwargs) -> FakeResponse | Exception 콜백을 받는다."""

    def __init__(self, responder):
        self._responder = responder

    async def _call(self, method, url, **kwargs):
        result = self._responder(method, url, **kwargs)
        if isinstance(result, BaseException):
            raise result
        return result

    async def get(self, url, **kwargs):
        return await self._call("GET", url, **kwargs)

    async def post(self, url, **kwargs):
        return await self._call("POST", url, **kwargs)

    async def delete(self, url, **kwargs):
        return await self._call("DELETE", url, **kwargs)

    async def request(self, method, url, **kwargs):
        return await self._call(method, url, **kwargs)
