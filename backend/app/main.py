"""FastAPI 앱 진입점. 미들웨어·라우터를 등록한다."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .http import close_client
from .limiter import limiter
from .routers import (
    account,
    bootstrap,
    contents,
    discover,
    folders,
    health,
    llm,
    profile,
    public,
    saves,
    search,
    tags,
    timeline,
    uploads,
    youtube,
)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # 공유 HTTP 클라이언트 정리
    await close_client()

DESCRIPTION = """
개인 취향 아카이빙 서비스 **Archive**의 백엔드 API입니다.

## 프론트 연동 기본값
- Base URL(로컬): `http://localhost:8001` → 프론트 `.env`의 `VITE_API_URL`
- 응답 JSON은 **camelCase** — 프론트 TS 타입과 1:1로 맞습니다.

## 인증 방법 🔒 (두 가지)

**방법 1 — 실토큰(Authorize) · 쓰기까지 전부 테스트할 때**
1. 프론트를 로그인한 상태에서 **access token**을 얻는다.
   - DevTools → Application → Local Storage → `sb-…-auth-token` 항목의 `access_token` 값 복사
   - 또는 콘솔: `const k=Object.keys(localStorage).find(k=>k.endsWith('-auth-token')); JSON.parse(localStorage.getItem(k)).access_token`
2. 우측 상단 **Authorize** 버튼에 붙여넣기 (`Bearer ` 접두어는 자동, 새로고침해도 유지)
3. 이후 모든 🔒 요청에 자동 첨부. (토큰은 약 1시간 뒤 만료 → 다시 복사)

**방법 2 — 토큰 없이 열기: `AUTH_OPTIONAL=true`**
- `backend/.env`에 `AUTH_OPTIONAL=true` 후 서버 재시작(로컬 전용, 배포에선 무시).
- ⚠️ **읽기·검색·LLM만** 열립니다. **DB 쓰기(프로필·폴더·콘텐츠)는 실패**(소유권 user_id가 실제 계정이어야 하는데 개발용 가짜 사용자라 FK 위반) → 쓰기 테스트는 **방법 1(실토큰)** 을 쓰세요.
"""

TAGS_METADATA = [
    {"name": "health", "description": "서버 상태 확인 — 인증 불필요."},
    {
        "name": "data",
        "description": "프로필·폴더·콘텐츠 데이터 — 읽기는 공개, 쓰기는 🔒 로그인 필요.",
    },
    {
        "name": "youtube",
        "description": "YouTube 검색 프록시 — API 키는 서버에만 있습니다. 🔒 로그인 필요.",
    },
    {
        "name": "llm",
        "description": "LLM 문구추천 — 키 은닉·인젝션 방어·rate limit 적용. 🔒 로그인 필요.",
    },
    {
        "name": "uploads",
        "description": "이미지 업로드 — 타입·크기·매직바이트 검증 후 Storage에 저장. 🔒 로그인 필요.",
    },
    {
        "name": "saves",
        "description": "찜 — 콘텐츠 북마크. 본인 찜만 조회/추가/해제. 🔒 로그인 필요.",
    },
    {
        "name": "public",
        "description": "공개 아카이브 — /u/{username}로 특정 사용자의 아카이브 조회(인증 불필요).",
    },
    {
        "name": "search",
        "description": "사용자 검색 — username·name 부분 일치(인증 불필요).",
    },
    {
        "name": "timeline",
        "description": "취향 타임라인 — 콘텐츠를 담은 시점을 월별로 집계(인증 불필요).",
    },
    {
        "name": "discover",
        "description": "유사 콘텐츠 추천 — 결이 비슷한 콘텐츠 발견(같은 채널·타입, 인증 불필요).",
    },
    {
        "name": "account",
        "description": "회원 탈퇴 — 계정 영구 삭제. 🔒 로그인 필요, 되돌릴 수 없습니다.",
    },
    {
        "name": "tags",
        "description": "콘텐츠 태그 — 자동(LLM)·수동 태깅. 읽기는 공개, 쓰기는 콘텐츠 소유자만 🔒.",
    },
]

app = FastAPI(
    title="Archive Backend API",
    description=DESCRIPTION,
    version="0.1.0",
    lifespan=lifespan,
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

# rate limit(per-IP) — 라우터의 @limiter.limit 데코레이터가 이 인스턴스를 사용.
app.state.limiter = limiter

# 보안 응답 헤더. Swagger(/docs 등)는 CDN 자원·인라인 스크립트가 필요해 CSP만 제외.
_STRICT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
_CSP_EXCLUDED = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    if not request.url.path.startswith(_CSP_EXCLUDED):
        # API 응답은 HTML/자원을 로드할 일이 없어 최대한 잠근다.
        response.headers.setdefault("Content-Security-Policy", _STRICT_CSP)
    if get_settings().is_production:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
        )
    return response

if settings.auth_optional:
    if settings.is_production:
        logger.warning("AUTH_OPTIONAL=true 는 production에서 무시됩니다.")
    else:
        logger.warning("AUTH_OPTIONAL=true — 인증 없이 API가 열려 있습니다(로컬 전용).")

app.include_router(health.router)
app.include_router(bootstrap.router)
app.include_router(profile.router)
app.include_router(folders.router)
app.include_router(contents.router)
app.include_router(youtube.router)
app.include_router(llm.router)
app.include_router(uploads.router)
app.include_router(saves.router)
app.include_router(public.router)
app.include_router(search.router)
app.include_router(timeline.router)
app.include_router(discover.router)
app.include_router(account.router)
app.include_router(tags.router)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """slowapi 초과를 표준 한국어 detail로 응답(기본 응답 형식 통일)."""
    return JSONResponse(
        status_code=429,
        content={"detail": "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """미처리 예외를 표준 500 응답으로 — 내부 정보(스택·쿼리)를 노출하지 않는다."""
    logger.exception("미처리 예외: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500, content={"detail": "서버 내부 오류가 발생했습니다."}
    )


@app.get("/", tags=["health"], summary="서비스 정보", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "archive-backend", "docs": "/docs"}
