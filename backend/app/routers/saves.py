"""찜(saves) — 로그인 사용자가 콘텐츠를 북마크(M7-A).

본인 찜만 조회/추가/해제. service_role이 RLS를 우회하므로 백엔드가
user_id를 직접 스탬프·스코프한다(소유권 이중 강제).
"""

from fastapi import APIRouter, Depends, Request

from .. import db
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_SAVES, limiter
from ..schemas import Content, SaveIn

router = APIRouter(prefix="/api/saves", tags=["saves"])

_ERRORS = {
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    503: {"description": "서버 쓰기 키(service_role) 미설정."},
}


@router.get(
    "",
    response_model=list[Content],
    summary="내 찜 목록 🔒",
    response_description="내가 찜한 콘텐츠(찜한 최신순)",
    responses=_ERRORS,
    description="현재 사용자가 찜한 콘텐츠 목록입니다. 응답은 콘텐츠 배열(Content[])입니다.",
)
@limiter.limit(LIMIT_SAVES)
async def list_saves(
    request: Request, user: CurrentUser = Depends(get_current_user)
) -> list[Content]:
    rows = await db.list_saved_contents(user.id)
    return [Content(**row) for row in rows]


@router.post(
    "",
    status_code=204,
    summary="찜 추가 🔒",
    response_description="찜 완료(본문 없음). 이미 찜한 경우도 204(멱등).",
    responses={**_ERRORS, 404: {"description": "존재하지 않는 콘텐츠."}},
    description="콘텐츠를 찜합니다. 이미 찜한 상태면 그대로 성공(멱등).",
)
@limiter.limit(LIMIT_SAVES)
async def add_save(
    request: Request, body: SaveIn, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.add_save(user.id, str(body.content_id))


@router.delete(
    "/{content_id}",
    status_code=204,
    summary="찜 해제 🔒",
    response_description="해제 완료(본문 없음). 찜하지 않은 경우도 204.",
    responses=_ERRORS,
    description="콘텐츠 찜을 해제합니다.",
)
@limiter.limit(LIMIT_SAVES)
async def remove_save(
    request: Request, content_id: str, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.remove_save(user.id, content_id)
