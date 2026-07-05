"""공개 아카이브(/api/u/{username}) — 멀티유저(M7-B).

특정 사용자의 공개 아카이브(프로필+폴더+콘텐츠)를 인증 없이 반환한다.
응답은 bootstrap(홈)과 동일한 형태(BootstrapResponse)라 프론트가 같은 방식으로 렌더링.
"""

from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..limiter import LIMIT_PUBLIC, limiter
from ..schemas import BootstrapResponse
from .bootstrap import build_archive_response

router = APIRouter(prefix="/api", tags=["public"])


@router.get(
    "/u/{username}",
    response_model=BootstrapResponse,
    summary="공개 아카이브 조회 (username)",
    response_description="해당 사용자의 프로필 + 폴더 + 콘텐츠 (bootstrap과 동일 형태)",
    responses={404: {"description": "해당 username의 사용자가 없음."}},
    description=(
        "username으로 특정 사용자의 공개 아카이브를 조회합니다(인증 불필요). "
        "응답은 `/api/bootstrap`과 동일한 `RepoData` 형태입니다."
    ),
)
@limiter.limit(LIMIT_PUBLIC)
async def public_archive(request: Request, username: str) -> BootstrapResponse:
    result = await db.fetch_public_archive(username.strip().lower())
    if result is None:
        raise HTTPException(404, "해당 사용자를 찾을 수 없습니다.")
    return build_archive_response(*result)
