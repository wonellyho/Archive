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
    # 공개 읽기용(RLS 공개 읽기 정책 하에서 조회). 프론트 anon 키와 동일 값.
    supabase_anon_key: str = ""
    # 쓰기용(서버 전용 비밀키!). P3(쓰기 API)부터 필요. 설정 시 읽기에도 우선 사용.
    supabase_service_role_key: str = ""

    # YouTube Data API v3 — 서버 전용! 절대 프론트에 두지 말 것
    youtube_api_key: str = ""

    # Claude API — LLM 문구추천(M6). 서버 전용 비밀키!
    anthropic_api_key: str = ""
    # LLM 모델(교체 시 이 값만 변경). 기본 = Claude Haiku 4.5.
    llm_model: str = "claude-haiku-4-5"
    # 토큰 예산: 응답 최대 토큰(비용·남용 상한). 12자 문구엔 400이면 충분.
    llm_max_tokens: int = 400
    # rate limit: 사용자당 60초 내 허용 호출 수(초과 시 429).
    llm_rate_per_min: int = 10

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
