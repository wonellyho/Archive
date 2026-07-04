"""공용 의존성(Dependency). 현재는 Supabase JWT 인증 가드를 제공한다."""

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    email: str | None = None


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    """Supabase 액세스 토큰(JWT)을 검증해 현재 사용자를 반환한다.

    - `Authorization: Bearer <access_token>` 헤더를 기대한다.
    - payload["sub"] 가 auth.users.id (이후 모든 쿼리를 이 값으로 스코프).
    - AUTH_OPTIONAL=true(개발용)이면 토큰이 없어도 개발 사용자로 통과시킨다.

    참고: Supabase가 비대칭 키(JWKS)를 쓰는 프로젝트라면 공유 시크릿 대신
    JWKS 공개키로 검증하도록 확장한다(게이트 위치는 동일).
    """
    settings = get_settings()

    if cred is None:
        if settings.auth_optional:
            return CurrentUser(id="dev-user", email="dev@local")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증 토큰이 필요합니다.")

    try:
        payload = jwt.decode(
            cred.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다.")

    return CurrentUser(id=payload["sub"], email=payload.get("email"))
