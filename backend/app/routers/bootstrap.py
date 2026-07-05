"""초기 데이터 로드. 프론트 supabaseRepository.loadAll()을 서버로 이관한 것.

인증 불필요 — 방문자(비로그인)도 프로필을 볼 수 있어야 한다. 쓰기는 P3에서 JWT 보호.
"""

from fastapi import APIRouter, Request

from .. import db
from ..limiter import LIMIT_BOOTSTRAP, limiter
from ..schemas import BootstrapResponse, Content, Folder, Profile, default_profile

router = APIRouter(prefix="/api", tags=["data"])


@router.get(
    "/bootstrap",
    response_model=BootstrapResponse,
    summary="초기 데이터 전체 로드 (공개)",
    response_description="프로필 + 음악/영상 폴더 + 음악/영상 콘텐츠 (프론트 RepoData와 동일)",
    responses={
        502: {"description": "데이터베이스 조회 실패 — 잠시 후 재시도."},
        503: {"description": "서버 환경변수(SUPABASE_URL/키) 미설정."},
    },
    description=(
        "프론트 `loadAll()`이 하던 3개 테이블 병렬 조회를 서버가 대신 수행합니다. "
        "비로그인 방문자도 호출 가능(공개 읽기). 폴더·콘텐츠는 `sortOrder` 오름차순 정렬."
    ),
)
@limiter.limit(LIMIT_BOOTSTRAP)
async def bootstrap(request: Request) -> BootstrapResponse:
    profile_row, folder_rows, content_rows = await db.fetch_bootstrap()

    profile = (
        Profile(
            name=profile_row.get("name", ""),
            tagline=profile_row.get("tagline", ""),
            bio=profile_row.get("bio", ""),
            keywords=profile_row.get("keywords") or [],
            profile_image_url=profile_row.get("profile_image_url"),
        )
        if profile_row
        else default_profile()
    )

    folders = [Folder(**row) for row in folder_rows]
    contents = [Content(**row) for row in content_rows]

    return BootstrapResponse(
        profile=profile,
        music_folders=[f for f in folders if f.type == "music"],
        video_folders=[f for f in folders if f.type == "video"],
        music_contents=[c for c in contents if c.type == "music"],
        video_contents=[c for c in contents if c.type == "video"],
    )
