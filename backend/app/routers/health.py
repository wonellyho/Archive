"""헬스체크 엔드포인트."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="서버 상태 확인",
    response_description='서버 정상 시 `{"status": "ok"}`',
)
def health() -> dict[str, str]:
    return {"status": "ok"}
