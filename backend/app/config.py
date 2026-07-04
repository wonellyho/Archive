"""환경변수 기반 설정. backend/.env 에서 로드한다."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 실행 위치(CWD)와 무관하게 항상 backend/.env 를 읽도록 절대경로로 고정.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # development | production — production에서는 AUTH_OPTIONAL이 무시된다.
    environment: str = "development"

    # CORS: 프론트 개발 서버 주소 (콤마로 여러 개 지정 가능)
    frontend_origins: str = "http://localhost:5173"

    # Supabase (Project Settings → API)
    # JWT 검증은 기본적으로 SUPABASE_URL 기반 JWKS(ES256 공개키)로 수행한다.
    supabase_url: str = ""
    # 레거시 HS256 프로젝트에서만 설정. 설정 시 JWKS 대신 공유 시크릿 검증.
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""

    # YouTube Data API v3 — 서버 전용! 절대 프론트에 두지 말 것
    youtube_api_key: str = ""

    # Claude API — 추후 LLM 기능
    anthropic_api_key: str = ""

    # 개발용: true면 토큰 없이도 API를 통과시킨다(로컬 통합 편의, 배포 환경 금지)
    auth_optional: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
