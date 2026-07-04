"""프로필 쓰기. 프론트 supabaseRepository.saveProfile()을 서버로 이관한 것."""

from fastapi import APIRouter, Depends

from .. import db
from ..deps import CurrentUser, get_current_user
from ..schemas import ProfileIn

router = APIRouter(prefix="/api", tags=["data"])


@router.put(
    "/profile",
    status_code=204,
    summary="프로필 저장 🔒",
    response_description="저장 성공(본문 없음)",
    responses={
        401: {"description": "인증 실패 — 로그인 토큰 필요."},
        503: {"description": "서버 쓰기 키(service_role) 미설정."},
    },
    description="프로필 전체를 교체 저장(upsert)합니다. 프론트 `saveProfile()`과 동일 동작.",
)
async def save_profile(
    body: ProfileIn, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.upsert_profile(
        {
            "name": body.name,
            "tagline": body.tagline,
            "bio": body.bio,
            "keywords": body.keywords,
            "profile_image_url": body.profile_image_url,
        }
    )
