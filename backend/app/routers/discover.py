"""유사 콘텐츠 추천(M8-B) — "결이 비슷한" 콘텐츠 발견.

주어진 콘텐츠와 **같은 채널(가중 2) > 같은 타입(가중 1)** 으로 유사 콘텐츠를 추천한다.
공개(인증 불필요). 데이터가 쌓이면 유저-유저 유사도로 확장 예정(후속).
"""

from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..limiter import LIMIT_PUBLIC, limiter
from ..schemas import Content, SimilarUser

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


def rank_similar_users(
    reference: dict, others: list[dict], limit: int = _MAX_RESULTS
) -> list[SimilarUser]:
    """공유 채널·키워드로 결이 비슷한 사용자를 정렬한다(점수 0은 제외).

    점수 = 공유 채널 수 × 2 + 공유 키워드 수 × 2. 동점은 username 순.
    """
    ref_channels = set(reference.get("channels") or [])
    ref_keywords = set(reference.get("keywords") or [])

    scored: list[SimilarUser] = []
    for other in others:
        shared_channels = ref_channels & set(other.get("channels") or [])
        shared_keywords = ref_keywords & set(other.get("keywords") or [])
        score = len(shared_channels) * 2 + len(shared_keywords) * 2
        if score > 0:
            scored.append(
                SimilarUser(
                    username=other.get("username"),
                    score=score,
                    shared_channels=sorted(shared_channels),
                    shared_keywords=sorted(shared_keywords),
                )
            )

    scored.sort(key=lambda u: (u.score, u.username), reverse=True)
    return scored[:limit]


@router.get(
    "/users/{username}",
    response_model=list[SimilarUser],
    summary="결이 비슷한 사용자 추천",
    response_description="공유 채널·키워드 기준 유사 사용자(최대 12)",
    responses={404: {"description": "기준 사용자를 찾을 수 없음."}},
    description=(
        "기준 사용자와 취향(채널·키워드 공출현)이 비슷한 사용자를 추천합니다(인증 불필요). "
        "멀티유저 데이터가 쌓일수록 유의미해집니다."
    ),
)
@limiter.limit(LIMIT_PUBLIC)
async def similar_users(request: Request, username: str) -> list[SimilarUser]:
    pool = await db.fetch_user_taste_pool(username.strip().lower())
    if pool is None:
        raise HTTPException(404, "해당 사용자를 찾을 수 없습니다.")
    reference, others = pool
    return rank_similar_users(reference, others)


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
