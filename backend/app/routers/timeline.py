"""취향 타임라인(M8-A) — 사용자가 콘텐츠를 담은 시점을 월별로 집계.

"선택의 축적과 맥락"을 시각화하는 기반. 공개(인증 불필요, username 기준).
"""

from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..limiter import LIMIT_PUBLIC, limiter
from ..schemas import TimelineBucket, TimelineResponse

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


def build_timeline(rows: list[dict]) -> list[TimelineBucket]:
    """콘텐츠 행(created_at, type)을 월(YYYY-MM)별 버킷으로 집계한다.

    created_at은 ISO 문자열이라 앞 7자가 곧 YYYY-MM(별도 파싱 불필요).
    """
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"music": 0, "video": 0})
    for row in rows:
        period = (row.get("created_at") or "")[:7]
        if len(period) != 7:
            continue
        content_type = row.get("type")
        if content_type in ("music", "video"):
            buckets[period][content_type] += 1

    result: list[TimelineBucket] = []
    for period in sorted(buckets):
        counts = buckets[period]
        result.append(
            TimelineBucket(
                period=period,
                music=counts["music"],
                video=counts["video"],
                total=counts["music"] + counts["video"],
            )
        )
    return result


@router.get(
    "/{username}",
    response_model=TimelineResponse,
    summary="취향 타임라인 (username)",
    response_description="기간(월)별 콘텐츠 집계 (오름차순)",
    responses={404: {"description": "해당 username의 사용자가 없음."}},
    description=(
        "사용자가 콘텐츠를 담은 시점을 월별로 집계합니다(인증 불필요). "
        "period(YYYY-MM)별로 total·music·video 개수를 반환합니다."
    ),
)
@limiter.limit(LIMIT_PUBLIC)
async def timeline(request: Request, username: str) -> TimelineResponse:
    normalized = username.strip().lower()
    rows = await db.fetch_timeline_rows(normalized)
    if rows is None:
        raise HTTPException(404, "해당 사용자를 찾을 수 없습니다.")
    return TimelineResponse(username=normalized, buckets=build_timeline(rows))
