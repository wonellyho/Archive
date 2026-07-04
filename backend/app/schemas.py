"""API 데이터 계약(Pydantic). JSON은 camelCase로 직렬화되어 프론트 TS 타입과 1:1로 맞는다."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ContentType = Literal["music", "video"]


class CamelModel(BaseModel):
    """파이썬은 snake_case, JSON 입출력은 camelCase(프론트 타입과 일치)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class YouTubeSearchResult(CamelModel):
    youtube_video_id: str = Field(
        description="YouTube 영상 ID (재생·등록에 사용)", examples=["BzYnNdJhZQw"]
    )
    title: str = Field(
        description="원본 영상 제목", examples=["[MV] IU(아이유) _ Through the Night(밤편지)"]
    )
    channel_title: str = Field(
        description="원본 채널명", examples=["1theK (원더케이)"]
    )
    thumbnail_url: str = Field(
        description="썸네일 URL (medium 우선)",
        examples=["https://i.ytimg.com/vi/BzYnNdJhZQw/mqdefault.jpg"],
    )


# ── 아래는 후속 이슈(프로필/폴더/콘텐츠 CRUD 이관)에서 사용할 데이터 계약 ──
class Profile(CamelModel):
    name: str = ""
    tagline: str = ""
    bio: str = ""
    keywords: list[str] = Field(default_factory=list)
    profile_image_url: Optional[str] = None


class ContentIn(CamelModel):
    """클라이언트가 보내는 콘텐츠 등록 요청. id/createdAt/userId는 서버가 발급."""

    type: ContentType
    folder_id: Optional[str] = None
    youtube_video_id: str = Field(min_length=1, max_length=32)
    source_title: str = Field(default="", max_length=300)
    source_channel: str = Field(default="", max_length=200)
    thumbnail_url: str = Field(default="", max_length=500)
    title: str = Field(default="", max_length=120)
    subtitle: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=2000)


class Content(ContentIn):
    id: str
    user_id: str
    sort_order: int
    created_at: datetime
