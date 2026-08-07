"""하이라이트 — 콘텐츠의 특정 시점에 남기는 타임스탬프+코멘트(M12, #56).

목록 조회는 공개(방문자도 가능), 등록·수정·삭제는 콘텐츠 소유자만.
콘텐츠당 개수 제한은 앱 레벨(POST 시 409)에서 강제 — 현재 값은 1개(TODO, 추후 재논의 가능).
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import db
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_HIGHLIGHTS, limiter
from ..schemas import Highlight, HighlightIn, HighlightPatch

router = APIRouter(prefix="/api", tags=["highlights"])

_MAX_PER_CONTENT = 1

_COMMON_ERRORS = {
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    503: {"description": "서버 쓰기 키(service_role) 미설정."},
}


@router.get(
    "/contents/{content_id}/highlights",
    response_model=list[Highlight],
    summary="하이라이트 목록",
    response_description="해당 콘텐츠의 하이라이트(현재 최대 1개, 등록순)",
    description="인증 없이 조회 가능한 공개 API입니다.",
)
@limiter.limit(LIMIT_HIGHLIGHTS)
async def list_highlights(request: Request, content_id: str) -> list[Highlight]:
    rows = await db.list_highlights(content_id)
    return [Highlight(**row) for row in rows]


@router.post(
    "/contents/{content_id}/highlights",
    status_code=201,
    response_model=Highlight,
    summary="하이라이트 등록 🔒",
    response_description="생성된 하이라이트",
    responses={
        **_COMMON_ERRORS,
        403: {"description": "콘텐츠 소유자가 아님."},
        404: {"description": "존재하지 않는 콘텐츠."},
        409: {"description": "콘텐츠당 개수 제한(1개) 초과."},
    },
    description="타임스탬프(초)와 코멘트를 등록합니다. 콘텐츠 소유자만 가능, 콘텐츠당 최대 1개.",
)
@limiter.limit(LIMIT_HIGHLIGHTS)
async def create_highlight(
    request: Request,
    content_id: str,
    body: HighlightIn,
    user: CurrentUser = Depends(get_current_user),
) -> Highlight:
    owner_id = await db.content_owner_id(content_id)
    if owner_id is None:
        raise HTTPException(404, "콘텐츠를 찾을 수 없습니다.")
    if owner_id != user.id:
        raise HTTPException(403, "콘텐츠 소유자만 하이라이트를 등록할 수 있습니다.")

    existing = await db.list_highlights(content_id)
    if len(existing) >= _MAX_PER_CONTENT:
        raise HTTPException(409, "콘텐츠당 하이라이트는 1개까지 등록할 수 있습니다.")

    try:
        row = await db.insert_row(
            "highlights",
            {
                "content_id": content_id,
                "user_id": user.id,
                "timestamp_seconds": body.timestamp_seconds,
                "comment": body.comment,
            },
        )
    except HTTPException as exc:
        if exc.status_code == 409:
            # 위 사전 확인 이후 동시 요청으로 경합했거나(마이그레이션의
            # uq_highlights_one_per_content가 최종 차단), 사전 확인과 삽입 사이에
            # 콘텐츠가 삭제된 경우(FK 위반) — 둘 다 _write()의 범용 메시지는
            # "폴더 참조 위반" 문구라 하이라이트 맥락에 안 맞으므로 대체한다.
            raise HTTPException(
                409, "하이라이트를 등록할 수 없습니다(개수 제한 초과 또는 존재하지 않는 콘텐츠)."
            )
        raise
    return Highlight(**row)


@router.patch(
    "/contents/{content_id}/highlights/{highlight_id}",
    status_code=204,
    summary="하이라이트 수정 🔒",
    response_description="수정 성공(본문 없음)",
    responses=_COMMON_ERRORS,
    description="timestampSeconds·comment 중 보낸 필드만 반영합니다. 소유자가 아니면 조용히 무시(0행).",
)
@limiter.limit(LIMIT_HIGHLIGHTS)
async def update_highlight(
    request: Request,
    content_id: str,
    highlight_id: str,
    body: HighlightPatch,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return
    await db.patch_row(
        "highlights", highlight_id, fields, user.id, extra={"content_id": f"eq.{content_id}"}
    )


@router.delete(
    "/contents/{content_id}/highlights/{highlight_id}",
    status_code=204,
    summary="하이라이트 삭제 🔒",
    response_description="삭제 성공(본문 없음)",
    responses=_COMMON_ERRORS,
    description="소유자가 아니거나 이미 없는 경우도 204(조용히 무시).",
)
@limiter.limit(LIMIT_HIGHLIGHTS)
async def delete_highlight(
    request: Request,
    content_id: str,
    highlight_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    await db.delete_rows(
        "highlights", "id", highlight_id, user.id, extra={"content_id": f"eq.{content_id}"}
    )
