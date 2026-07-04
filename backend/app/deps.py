"""공용 의존성(Dependency). 현재는 Supabase JWT 인증 가드를 제공한다."""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

logger = logging.getLogger(__name__)

bearer = HTTPBearer(
    auto_error=False,
    scheme_name="SupabaseJWT",
    description="Supabase 로그인 후 발급되는 access token을 붙여넣으세요. "
    "(프론트: `supabase.auth.getSession()` → `session.access_token`)",
)


@dataclass
class CurrentUser:
    id: str
    email: str | None = None


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    """JWKS 클라이언트(공개키 캐시 포함)를 재사용한다."""
    return jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)


def _decode_token(token: str) -> dict[str, Any]:
    """Supabase 액세스 토큰(JWT)을 검증해 payload를 반환한다.

    - 기본: JWKS 공개키 검증(비대칭). 이 프로젝트의 서명 키는 ECC(P-256) = ES256.
    - 폴백: SUPABASE_JWT_SECRET이 설정된 경우에만 HS256(레거시 공유 시크릿) 검증.
    """
    settings = get_settings()

    if settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    if not settings.supabase_url:
        raise HTTPException(503, "서버에 SUPABASE_URL이 설정되지 않았습니다.")

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
    except jwt.PyJWTError:
        raise
    except Exception:
        # JWKS 조회(네트워크) 실패 — 토큰 문제(401)가 아니라 서버 문제(503)로 구분.
        logger.exception("JWKS 조회에 실패했습니다: %s", jwks_url)
        raise HTTPException(503, "인증 키 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.")

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    """Supabase 액세스 토큰(JWT)을 검증해 현재 사용자를 반환한다.

    - `Authorization: Bearer <access_token>` 헤더를 기대한다.
    - payload["sub"] 가 auth.users.id (이후 모든 쿼리를 이 값으로 스코프).
    - AUTH_OPTIONAL=true(개발용)이면 토큰이 없어도 개발 사용자로 통과시킨다.
      단, ENVIRONMENT=production 에서는 무시된다.
    """
    settings = get_settings()

    if cred is None:
        if settings.auth_optional and not settings.is_production:
            return CurrentUser(id="dev-user", email="dev@local")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증 토큰이 필요합니다.")

    try:
        payload = _decode_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다.")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다.")

    return CurrentUser(id=sub, email=payload.get("email"))
