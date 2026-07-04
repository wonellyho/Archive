"""FastAPI 앱 진입점. 미들웨어·라우터를 등록한다."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import health, youtube

logger = logging.getLogger(__name__)
settings = get_settings()

DESCRIPTION = """
개인 취향 아카이빙 서비스 **Archive**의 백엔드 API입니다.

## 프론트 연동 기본값
- Base URL(로컬): `http://localhost:8001` → 프론트 `.env`의 `VITE_API_URL`
- 응답 JSON은 **camelCase** — 프론트 TS 타입과 1:1로 맞습니다.

## 인증 방법 🔒
잠금 표시가 있는 엔드포인트는 Supabase 로그인 토큰이 필요합니다.

1. 프론트(또는 Supabase)에서 로그인 후 **access token**을 얻는다.
2. 우측 상단 **Authorize** 버튼을 눌러 토큰을 붙여넣는다. (`Bearer ` 접두어는 자동)
3. 이후 모든 요청에 토큰이 자동 첨부된다. (새로고침해도 유지)

> 로컬에서 토큰 없이 테스트하려면 `backend/.env`에 `AUTH_OPTIONAL=true` (배포 환경에서는 무시됨)
"""

TAGS_METADATA = [
    {"name": "health", "description": "서버 상태 확인 — 인증 불필요."},
    {
        "name": "youtube",
        "description": "YouTube 검색 프록시 — API 키는 서버에만 있습니다. 🔒 로그인 필요.",
    },
]

app = FastAPI(
    title="Archive Backend API",
    description=DESCRIPTION,
    version="0.1.0",
    openapi_tags=TAGS_METADATA,
    swagger_ui_parameters={
        # 발급받은 토큰을 새로고침 후에도 유지 (프론트 DX)
        "persistAuthorization": True,
        # 엔드포인트 목록을 펼친 상태로 시작
        "docExpansion": "list",
        # 하단 스키마 모델 목록은 접어서 시작
        "defaultModelsExpandDepth": 0,
        # 응답 시간 표시
        "displayRequestDuration": True,
    },
)

# 인증은 쿠키가 아니라 Authorization: Bearer 헤더로 하므로 credentials는 불필요.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

if settings.auth_optional:
    if settings.is_production:
        logger.warning("AUTH_OPTIONAL=true 는 production에서 무시됩니다.")
    else:
        logger.warning("AUTH_OPTIONAL=true — 인증 없이 API가 열려 있습니다(로컬 전용).")

app.include_router(health.router)
app.include_router(youtube.router)


@app.get("/", tags=["health"], summary="서비스 정보", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "archive-backend", "docs": "/docs"}
