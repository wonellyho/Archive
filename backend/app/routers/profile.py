"""프로필 조회/쓰기. 프론트 supabaseRepository.saveProfile() 이관 + 내 프로필 조회."""

from fastapi import APIRouter, Depends

from .. import db
from ..deps import CurrentUser, get_current_user
from ..schemas import Profile, ProfileIn, default_profile

router = APIRouter(prefix="/api", tags=["data"])


@router.get(
    "/me",
    response_model=Profile,
    summary="내 프로필 조회 🔒",
    response_description="현재 로그인한 사용자의 프로필(username 포함)",
    responses={401: {"description": "인증 실패 — 로그인 토큰 필요."}},
    description=(
        "로그인한 본인의 프로필을 반환합니다(토큰의 사용자 기준). "
        "아직 프로필을 저장한 적 없는 신규 사용자는 기본 프로필을 반환합니다(404 아님)."
    ),
)
async def get_me(user: CurrentUser = Depends(get_current_user)) -> Profile:
    row = await db.fetch_profile(user.id)
    if not row:
        return default_profile()
    return Profile(
        name=row.get("name", ""),
        tagline=row.get("tagline", ""),
        bio=row.get("bio", ""),
        keywords=row.get("keywords") or [],
        profile_image_url=row.get("profile_image_url"),
        username=row.get("username"),
    )


@router.put(
    "/profile",
    status_code=204,
    summary="프로필 저장 🔒",
    response_description="저장 성공(본문 없음)",
    responses={
        401: {"description": "인증 실패 — 로그인 토큰 필요."},
        409: {"description": "이미 사용 중인 username."},
        422: {"description": "username 형식 위반 또는 필드 길이 초과."},
        503: {"description": "서버 쓰기 키(service_role) 미설정."},
    },
    description=(
        "현재 사용자의 프로필을 저장(upsert)합니다. 본인 프로필만 대상(1인 1행). "
        "username을 주면 공개 페이지(/u/{username}) 주소가 됩니다."
    ),
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
        },
        user.id,
        body.username,
    )
