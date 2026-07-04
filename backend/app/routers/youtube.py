"""YouTube 검색 프록시. 프론트의 youtubeService.searchYouTube() 로직을 서버로 이관한 것.

핵심: API 키를 서버에만 두고(키 은닉), 인증된 사용자만 검색할 수 있게 한다(할당량 남용 차단).
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import get_settings
from ..deps import CurrentUser, get_current_user
from ..schemas import YouTubeSearchResult

router = APIRouter(prefix="/api/youtube", tags=["youtube"])

SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"


@router.get("/search", response_model=list[YouTubeSearchResult])
async def search(
    q: str = Query(min_length=2, max_length=100, description="검색어"),
    content_type: str = Query(
        "music", alias="type", pattern="^(music|video)$", description="music | video"
    ),
    user: CurrentUser = Depends(get_current_user),
) -> list[YouTubeSearchResult]:
    settings = get_settings()
    if not settings.youtube_api_key:
        raise HTTPException(503, "서버에 YouTube API 키가 설정되지 않았습니다.")

    params = {
        "part": "snippet",
        "type": "video",
        "maxResults": "12",
        "q": q,
        "key": settings.youtube_api_key,
    }
    if content_type == "music":
        params["videoCategoryId"] = "10"  # 음악 카테고리(기존 로직 유지)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(SEARCH_ENDPOINT, params=params)
    except httpx.HTTPError:
        raise HTTPException(502, "YouTube 요청에 실패했습니다.")

    if resp.status_code == 403:
        raise HTTPException(429, "YouTube 할당량 초과 또는 키가 유효하지 않습니다.")
    if resp.status_code != 200:
        raise HTTPException(502, f"YouTube 오류 (HTTP {resp.status_code}).")

    results: list[YouTubeSearchResult] = []
    for item in resp.json().get("items", []):
        video_id = (item.get("id") or {}).get("videoId")
        if not video_id:
            continue
        snippet = item.get("snippet") or {}
        thumbs = snippet.get("thumbnails") or {}
        pick = thumbs.get("medium") or thumbs.get("high") or thumbs.get("default") or {}
        results.append(
            YouTubeSearchResult(
                youtube_video_id=video_id,
                title=snippet.get("title") or "(제목 없음)",
                channel_title=snippet.get("channelTitle") or "",
                thumbnail_url=pick.get("url")
                or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            )
        )
    return results
