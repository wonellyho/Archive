"""폴더 쓰기. 프론트 supabaseRepository의 addFolder/updateFolder/deleteFolder 이관."""

from fastapi import APIRouter, Depends

from .. import db
from ..deps import CurrentUser, get_current_user
from ..schemas import Folder, FolderIn, FolderPatch

router = APIRouter(prefix="/api/folders", tags=["data"])

_COMMON_ERRORS = {
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    503: {"description": "서버 쓰기 키(service_role) 미설정."},
}


@router.post(
    "",
    status_code=201,
    response_model=Folder,
    summary="폴더 생성 🔒",
    response_description="생성된 폴더(서버 권위 createdAt·sortOrder 포함)",
    responses={**_COMMON_ERRORS, 409: {"description": "중복 ID."}},
    description=(
        "id는 클라이언트가 생성한 UUID를 검증 후 수용합니다"
        "(프론트 낙관적 업데이트의 동기 반환 계약 보존). "
        "sortOrder는 서버가 type별 max+1로 계산하고, createdAt은 DB가 발급합니다."
    ),
)
async def create_folder(
    body: FolderIn, user: CurrentUser = Depends(get_current_user)
) -> Folder:
    sort_order = await db.next_sort_order("folders", body.type)
    row = await db.insert_row(
        "folders",
        {
            "id": str(body.id),
            "type": body.type,
            "name": body.name,
            "cover_image_url": body.cover_image_url,
            "sort_order": sort_order,
        },
    )
    return Folder(**row)


@router.patch(
    "/{folder_id}",
    status_code=204,
    summary="폴더 수정 🔒",
    response_description="수정 성공(본문 없음)",
    responses=_COMMON_ERRORS,
    description=(
        "보낸 필드만 반영합니다. `coverImageUrl`은 [필드 없음]=변경 안 함 / "
        "[null]=커버 제거 로 구분됩니다(프론트 updateFolder 시맨틱과 동일)."
    ),
)
async def update_folder(
    folder_id: str, body: FolderPatch, user: CurrentUser = Depends(get_current_user)
) -> None:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return
    await db.patch_row("folders", folder_id, fields)


@router.delete(
    "/{folder_id}",
    status_code=204,
    summary="폴더 삭제 (내부 콘텐츠 포함) 🔒",
    response_description="삭제 성공(본문 없음)",
    responses=_COMMON_ERRORS,
    description="폴더 안의 콘텐츠를 먼저 삭제한 뒤 폴더를 삭제합니다(캐스케이드).",
)
async def delete_folder(
    folder_id: str, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.delete_rows("contents", "folder_id", folder_id)
    await db.delete_rows("folders", "id", folder_id)
