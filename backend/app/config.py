"""환경변수 기반 설정. backend/.env 에서 로드한다."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # CORS: 프론트 개발 서버 주소 (콤마로 여러 개 지정 가능)
    frontend_origins: str = "http://localhost:5173"

    # Supabase (Project Settings → API)
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""

    # YouTube Data API v3 — 서버 전용! 절대 프론트에 두지 말 것
    youtube_api_key: str = ""

    # Claude API — 추후 LLM 기능
    anthropic_api_key: str = ""

    # 개발용: true면 토큰 없이도 API를 통과시킨다(로컬 통합 편의, 배포 환경 금지)
    auth_optional: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
