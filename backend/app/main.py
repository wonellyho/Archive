"""FastAPI 앱 진입점. 미들웨어·라우터를 등록한다."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import health, youtube

settings = get_settings()

app = FastAPI(
    title="Archive Backend API",
    description="개인 취향 아카이빙 서비스 Archive의 백엔드 (FastAPI).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(youtube.router)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"service": "archive-backend", "docs": "/docs"}
