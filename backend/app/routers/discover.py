"""유사 콘텐츠 추천(M8-B) — "결이 비슷한" 콘텐츠 발견.

주어진 콘텐츠와 **같은 채널(가중 2) > 같은 타입(가중 1)** 으로 유사 콘텐츠를 추천한다.
공개(인증 불필요). 데이터가 쌓이면 유저-유저 유사도로 확장 예정(후속).
"""

from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..limiter import LIMIT_PUBLIC, limiter
from ..schemas import Content

router = APIRouter(prefix="/api/discover", tags=["discover"])

_MAX_RESULTS = 12


def rank_similar(
    target: dict, candidates: list[dict], limit: int = _MAX_RESULTS
) -> list[dict]:
    """대상과의 유사도로 후보를 정렬한다(자기 자신 제외, 점수 0은 제외).

    점수 = 같은 채널(+2) + 같은 타입(+1). 동점은 최신(created_at) 우선.
    """
    target_id = target.get("id")
    target_type = target.get("type")
    target_channel = target.get("source_channel") or ""

    scored: list[tuple[int, str, dict]] = []
    for row in candidates:
        if row.get("id") == target_id:
            continue
        score = 0
        if target_channel and row.get("source_channel") == target_channel:
            score += 2
        if row.get("type") == target_type:
            score += 1
        if score > 0:
            scored.append((score, row.get("created_at") or "", row))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [row for _, _, row in scored[:limit]]


@router.get(
    "/similar/{content_id}",
    response_model=list[Content],
    summary="유사 콘텐츠 추천",
    response_description="결이 비슷한 콘텐츠(같은 채널 우선, 최대 12개)",
    responses={404: {"description": "기준 콘텐츠를 찾을 수 없음."}},
    description=(
        "주어진 콘텐츠와 결이 비슷한 콘텐츠를 추천합니다(인증 불필요). "
        "같은 채널을 가장 강하게, 그다음 같은 타입(음악/영상)을 반영합니다."
    ),
)
@limiter.limit(LIMIT_PUBLIC)
async def similar(request: Request, content_id: str) -> list[Content]:
    pool = await db.fetch_similar_pool(content_id)
    if pool is None:
        raise HTTPException(404, "콘텐츠를 찾을 수 없습니다.")
    target, candidates = pool
    return [Content(**row) for row in rank_similar(target, candidates)]
