"""FastAPI 앱 진입점. 미들웨어·라우터를 등록한다."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import health, youtube

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(
    title="Archive Backend API",
    description="개인 취향 아카이빙 서비스 Archive의 백엔드 (FastAPI).",
    version="0.1.0",
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


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"service": "archive-backend", "docs": "/docs"}
