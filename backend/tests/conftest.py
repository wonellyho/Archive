"""테스트 공통 픽스처.

인증 게이트 테스트가 로컬 `backend/.env`의 `AUTH_OPTIONAL` 값에 좌우되지 않도록,
모든 테스트에서 auth_optional을 결정적으로 False로 고정한다(스웨거 수동 테스트용으로
.env를 true로 켜둔 상태에서도 pytest가 동일하게 통과하도록).
"""

import pytest

from app.config import get_settings
from app.limiter import limiter


@pytest.fixture(autouse=True)
def _deterministic_auth():
    settings = get_settings()  # lru_cache 싱글턴
    original = settings.auth_optional
    settings.auth_optional = False
    yield
    settings.auth_optional = original


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """기본적으로 rate limit을 끈다(누적 카운트로 기존 테스트가 흔들리지 않게).

    rate limit 자체를 검증하는 테스트만 내부에서 limiter.enabled = True로 켠다.
    """
    limiter.enabled = False
    yield
    limiter.enabled = True
