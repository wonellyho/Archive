"""사용자 검색(부분 일치, M10) — username·name으로 후보 사용자를 찾는다.

기존 `GET /api/u/{username}`(정확 일치)과는 응답 형태가 달라 별도 유지한다:
`/u/{username}`은 프로필+전체 폴더+콘텐츠(무거운 "페이지 로드용"), 이 엔드포인트는
검색창 타이핑마다 호출되는 가벼운 "후보 목록용"(username·name만). 검색 결과를
클릭하면 결국 `/u/{username}`을 호출해 실제 페이지를 로드한다.
"""

from fastapi import APIRouter, Query, Request

from .. import db
from ..limiter import LIMIT_PUBLIC, limiter
from ..schemas import UserSearchResult

router = APIRouter(prefix="/api/search", tags=["search"])

_MAX_RESULTS = 20  # TODO(#54): 결과 개수 상한 — 잠정값, 실사용 데이터로 재검토


def rank_users(
    query: str, candidates: list[dict], limit: int = _MAX_RESULTS
) -> list[dict]:
    """query가 username 또는 name에 부분 포함되는 후보만 골라 정렬한다(대소문자 무시).

    정렬 기준(TODO(#54): 잠정값 — 가입순/알파벳 등 재검토 여지 있음):
    username이 검색어로 **시작하는** 후보를 먼저, 그다음 알파벳순.

    공백만 있는 검색어(예: `"   "`)는 strip 후 빈 문자열이 되는데, 빈 문자열은
    모든 문자열의 부분집합이라 필터링 없이 전체가 매치되어버린다 — 그러면
    인증 없이도 사실상 "전체 유저 목록"이 노출되므로 빈 문자열이면 즉시 빈
    결과를 반환한다.
    """
    q = query.strip().lower()
    if not q:
        return []

    matched: list[tuple[bool, str, dict]] = []
    for row in candidates:
        username = (row.get("username") or "").lower()
        name = (row.get("name") or "").lower()
        if q in username or q in name:
            matched.append((not username.startswith(q), username, row))

    matched.sort(key=lambda item: (item[0], item[1]))
    return [row for _, _, row in matched[:limit]]


@router.get(
    "/users",
    response_model=list[UserSearchResult],
    summary="사용자 검색 (부분 일치)",
    response_description=f"username 또는 name에 검색어가 포함된 사용자 목록(최대 {_MAX_RESULTS})",
    description=(
        "username·name 부분 일치로 사용자를 검색합니다(인증 불필요). "
        "검색창 타이핑마다 호출되는 가벼운 후보 목록용 — 실제 페이지 로드는 "
        "`GET /api/u/{username}`을 이용하세요."
    ),
)
@limiter.limit(LIMIT_PUBLIC)
async def search_users(
    request: Request,
    q: str = Query(min_length=1, max_length=50, description="검색어(username 또는 name)"),
) -> list[UserSearchResult]:
    candidates = await db.fetch_searchable_users()
    return [UserSearchResult(**row) for row in rank_users(q, candidates)]
