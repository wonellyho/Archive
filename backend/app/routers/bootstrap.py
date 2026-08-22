"""초기 데이터 로드. 프론트 supabaseRepository.loadAll()을 서버로 이관한 것.

#66부터는 "홈 = 로그인한 사용자 본인의 아카이브"로 바뀌어 인증이 필요하다.
방문자(비로그인)를 위한 공개 열람은 `/api/u/{username}`(routers/public.py)이 맡는다.
"""

from fastapi import APIRouter, Depends, Request

from .. import db
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_BOOTSTRAP, limiter
from ..schemas import (
    BoardSettings,
    BootstrapResponse,
    Content,
    Folder,
    Pin,
    Profile,
    default_profile,
)

router = APIRouter(prefix="/api", tags=["data"])


def build_archive_response(
    profile_row: dict | None,
    folder_rows: list[dict],
    content_rows: list[dict],
    pin_rows: list[dict] | None = None,
    board_row: dict | None = None,
) -> BootstrapResponse:
    """DB 행들을 프론트 RepoData(BootstrapResponse) 형태로 조립한다.

    bootstrap(홈)과 공개 아카이브(/api/u/{username})가 공유한다.
    """
    profile = (
        Profile(
            name=profile_row.get("name", ""),
            tagline=profile_row.get("tagline", ""),
            bio=profile_row.get("bio", ""),
            keywords=profile_row.get("keywords") or [],
            profile_image_url=profile_row.get("profile_image_url"),
            username=profile_row.get("username"),
        )
        if profile_row
        else default_profile()
    )
    folders = [Folder(**row) for row in folder_rows]
    contents = [Content(**row) for row in content_rows]
    pins = [Pin(**row) for row in (pin_rows or [])]
    return BootstrapResponse(
        profile=profile,
        music_folders=[f for f in folders if f.type == "music"],
        video_folders=[f for f in folders if f.type == "video"],
        music_contents=[c for c in contents if c.type == "music"],
        video_contents=[c for c in contents if c.type == "video"],
        pins=pins,
        pin_board=BoardSettings(**board_row) if board_row else BoardSettings(),
    )


@router.get(
    "/bootstrap",
    response_model=BootstrapResponse,
    summary="내 아카이브 전체 로드 🔒",
    response_description="프로필 + 음악/영상 폴더 + 음악/영상 콘텐츠 (프론트 RepoData와 동일)",
    responses={
        401: {"description": "인증 실패 — 로그인 토큰 필요."},
        502: {"description": "데이터베이스 조회 실패 — 잠시 후 재시도."},
        503: {"description": "서버 환경변수(SUPABASE_URL/키) 미설정."},
    },
    description=(
        "프론트 `loadAll()`이 하던 3개 테이블 병렬 조회를 서버가 대신 수행합니다. "
        "로그인한 본인(user_id) 소유 데이터만 반환합니다(홈 = 내 아카이브). "
        "아직 프로필을 저장한 적 없는 신규 사용자는 기본 프로필 + 빈 폴더/콘텐츠를 받습니다. "
        "폴더·콘텐츠는 `sortOrder` 오름차순 정렬."
    ),
)
@limiter.limit(LIMIT_BOOTSTRAP)
async def bootstrap(
    request: Request, user: CurrentUser = Depends(get_current_user)
) -> BootstrapResponse:
    profile_row, folder_rows, content_rows, pin_rows, board_row = await db.fetch_bootstrap(user.id)
    return build_archive_response(profile_row, folder_rows, content_rows, pin_rows, board_row)
