"""인증 의존성(app/deps.py) 단위 테스트 — JWT 검증 로직 자체를 직접 검증.

기존 라우터 테스트들은 `get_current_user`를 dependency_override로 통째로 대체해서
쓰기 때문에, 실제 토큰 검증 로직(JWKS·HS256 폴백·에러 분기)은 그동안 어디서도
직접 실행되지 않았다. 이 파일은 그 로직 자체를 대상으로 한다.
"""

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import deps
from app.config import get_settings


def _cred(token="sometoken"):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture
def settings():
    s = get_settings()
    orig = (s.auth_optional, s.environment, s.supabase_jwt_secret, s.supabase_url)
    yield s
    s.auth_optional, s.environment, s.supabase_jwt_secret, s.supabase_url = orig


# ── get_current_user: AUTH_OPTIONAL 개발 편의 경로 ──


def test_dev_user_when_auth_optional_and_no_token(settings):
    """AUTH_OPTIONAL=true + 토큰 없음 + 개발 환경 → 가짜 개발 사용자로 통과시킨다."""
    settings.auth_optional = True
    settings.environment = "development"
    user = deps.get_current_user(cred=None)
    assert user.id == "dev-user"


def test_401_when_no_token_and_auth_optional_off(settings):
    """AUTH_OPTIONAL이 꺼져 있으면 토큰 없는 요청은 그냥 401."""
    settings.auth_optional = False
    with pytest.raises(HTTPException) as exc:
        deps.get_current_user(cred=None)
    assert exc.value.status_code == 401


def test_401_when_no_token_even_if_auth_optional_in_production(settings):
    """production에서는 AUTH_OPTIONAL=true여도 무시되고 토큰이 없으면 401."""
    # production에서는 AUTH_OPTIONAL이 무시되어야 한다(§config 규칙).
    settings.auth_optional = True
    settings.environment = "production"
    with pytest.raises(HTTPException) as exc:
        deps.get_current_user(cred=None)
    assert exc.value.status_code == 401


# ── get_current_user: 토큰 있는 경우 ──


def test_returns_user_for_valid_token(monkeypatch):
    """_decode_token이 정상 payload를 돌려주면 sub·email로 CurrentUser를 만든다."""
    monkeypatch.setattr(deps, "_decode_token", lambda token: {"sub": "u1", "email": "a@b.com"})
    user = deps.get_current_user(cred=_cred())
    assert user.id == "u1" and user.email == "a@b.com"


def test_401_when_token_invalid(monkeypatch):
    """_decode_token이 PyJWTError를 던지면 401로 변환된다."""
    def fake_decode(token):
        raise jwt.InvalidTokenError("bad token")

    monkeypatch.setattr(deps, "_decode_token", fake_decode)
    with pytest.raises(HTTPException) as exc:
        deps.get_current_user(cred=_cred())
    assert exc.value.status_code == 401


def test_401_when_sub_missing(monkeypatch):
    """payload에 sub 클레임이 없으면 불완전한 토큰으로 보고 401."""
    monkeypatch.setattr(deps, "_decode_token", lambda token: {"email": "a@b.com"})
    with pytest.raises(HTTPException) as exc:
        deps.get_current_user(cred=_cred())
    assert exc.value.status_code == 401


# ── _decode_token: HS256 폴백 vs JWKS 기본 경로 ──


def test_decode_token_uses_hs256_when_secret_configured(settings, monkeypatch):
    """SUPABASE_JWT_SECRET이 설정돼 있으면 JWKS 대신 HS256 공유 시크릿으로 검증한다(레거시 폴백)."""
    settings.supabase_jwt_secret = "shared-secret"
    captured = {}

    def fake_jwt_decode(token, key, algorithms, audience):
        captured.update(token=token, key=key, algorithms=algorithms)
        return {"sub": "u1"}

    monkeypatch.setattr(jwt, "decode", fake_jwt_decode)
    result = deps._decode_token("tok")
    assert result == {"sub": "u1"}
    assert captured == {"token": "tok", "key": "shared-secret", "algorithms": ["HS256"]}


def test_decode_token_missing_url_returns_503(settings):
    """HS256 시크릿도 SUPABASE_URL도 없으면 검증할 방법이 없어 503."""
    settings.supabase_jwt_secret = ""
    settings.supabase_url = ""
    with pytest.raises(HTTPException) as exc:
        deps._decode_token("tok")
    assert exc.value.status_code == 503


def test_decode_token_jwks_success(settings, monkeypatch):
    """기본 경로: JWKS에서 공개키를 가져와 ES256/RS256으로 검증한다."""
    settings.supabase_jwt_secret = ""
    settings.supabase_url = "https://project.supabase.co"

    fake_signing_key = type("SigningKey", (), {"key": "public-key"})()
    fake_jwks_client = type(
        "JWKSClient", (), {"get_signing_key_from_jwt": lambda self, token: fake_signing_key}
    )()
    monkeypatch.setattr(deps, "_jwks_client", lambda url: fake_jwks_client)
    monkeypatch.setattr(jwt, "decode", lambda token, key, algorithms, audience: {"sub": "u2"})

    assert deps._decode_token("tok") == {"sub": "u2"}


def test_decode_token_jwks_lookup_failure_returns_503(settings, monkeypatch):
    """JWKS 조회가 네트워크 오류 등으로 실패하면 토큰 문제(401)가 아니라 서버 문제(503)로 구분한다."""
    settings.supabase_jwt_secret = ""
    settings.supabase_url = "https://project.supabase.co"

    def raise_network_error(url):
        raise ConnectionError("network down")

    monkeypatch.setattr(deps, "_jwks_client", raise_network_error)
    with pytest.raises(HTTPException) as exc:
        deps._decode_token("tok")
    assert exc.value.status_code == 503


def test_decode_token_jwks_invalid_signature_reraises_pyjwt_error(settings, monkeypatch):
    """JWKS 조회 중 PyJWTError(서명 불일치 등)는 503으로 감추지 않고 그대로 올려 get_current_user가 401로 처리하게 한다."""
    settings.supabase_jwt_secret = ""
    settings.supabase_url = "https://project.supabase.co"

    def raise_pyjwt_error(url):
        raise jwt.InvalidTokenError("bad signature")

    monkeypatch.setattr(deps, "_jwks_client", raise_pyjwt_error)
    with pytest.raises(jwt.InvalidTokenError):
        deps._decode_token("tok")
