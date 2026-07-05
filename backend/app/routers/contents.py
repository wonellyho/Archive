"""콘텐츠 쓰기. 프론트 supabaseRepository의 addContent/updateContent/deleteContent 이관."""

from fastapi import APIRouter, Depends

from .. import db
from ..deps import CurrentUser, get_current_user
from ..schemas import Content, ContentIn, ContentPatch

router = APIRouter(prefix="/api/contents", tags=["data"])

_COMMON_ERRORS = {
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    503: {"description": "서버 쓰기 키(service_role) 미설정."},
}


@router.post(
    "",
    status_code=201,
    response_model=Content,
    summary="콘텐츠 등록 🔒",
    response_description="생성된 콘텐츠(서버 권위 createdAt·sortOrder 포함)",
    responses={**_COMMON_ERRORS, 409: {"description": "중복 ID 또는 유효하지 않은 폴더 참조."}},
    description=(
        "YouTube 출처 정보와 사용자 큐레이션(제목·부제·본문)을 함께 저장합니다. "
        "id는 클라이언트 UUID를 검증 후 수용, sortOrder는 서버가 type별 max+1로 계산."
    ),
)
async def create_content(
    body: ContentIn, user: CurrentUser = Depends(get_current_user)
) -> Content:
    sort_order = await db.next_sort_order("contents", body.type, user.id)
    row = await db.insert_row(
        "contents",
        {
            "id": str(body.id),
            "type": body.type,
            "folder_id": body.folder_id,
            "youtube_video_id": body.youtube_video_id,
            "source_title": body.source_title,
            "source_channel": body.source_channel,
            "thumbnail_url": body.thumbnail_url,
            "title": body.title,
            "subtitle": body.subtitle,
            "body": body.body,
            "sort_order": sort_order,
            "user_id": user.id,
        },
    )
    return Content(**row)


@router.patch(
    "/{content_id}",
    status_code=204,
    summary="콘텐츠 수정 🔒",
    response_description="수정 성공(본문 없음)",
    responses=_COMMON_ERRORS,
    description="사용자 작성 필드(title·subtitle·body)만 수정합니다. 보낸 필드만 반영.",
)
async def update_content(
    content_id: str, body: ContentPatch, user: CurrentUser = Depends(get_current_user)
) -> None:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return
    await db.patch_row("contents", content_id, fields, user.id)


@router.delete(
    "/{content_id}",
    status_code=204,
    summary="콘텐츠 삭제 🔒",
    response_description="삭제 성공(본문 없음)",
    responses=_COMMON_ERRORS,
)
async def delete_content(
    content_id: str, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.delete_rows("contents", "id", content_id, user.id)
