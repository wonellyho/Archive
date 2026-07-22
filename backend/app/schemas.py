"""API 데이터 계약(Pydantic). JSON은 camelCase로 직렬화되어 프론트 TS 타입과 1:1로 맞는다."""

import re
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

ContentType = Literal["music", "video"]

# username: 영문 소문자·숫자·_·- 3~30자. 예약어는 공개 라우트/시스템과 충돌 방지.
_USERNAME_RE = re.compile(r"^[a-z0-9_-]{3,30}$")
_RESERVED_USERNAMES = {
    "me", "api", "admin", "administrator", "root", "u", "user", "users",
    "health", "docs", "redoc", "openapi", "bootstrap", "saves", "uploads",
    "llm", "youtube", "profile", "profiles", "folders", "contents", "www",
    "null", "undefined", "system", "support",
}


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


# ── 데이터 계약 (프론트 types/*.ts 와 1:1) ──
# created_at은 파리티(기존 loadAll이 문자열 그대로 전달)를 위해 str로 통과시킨다.


class Profile(CamelModel):
    """프론트 types/profile.ts Profile."""

    name: str = ""
    tagline: str = ""
    bio: str = ""
    keywords: list[str] = Field(default_factory=list)
    profile_image_url: Optional[str] = Field(
        default=None, description="프로필 이미지(Storage URL 또는 data URL)"
    )
    username: Optional[str] = Field(
        default=None, description="공개 페이지 주소(/u/{username})용. 없을 수 있음."
    )


def default_profile() -> Profile:
    """프론트 storageService.ts defaultProfile 과 동일 (프로필 행이 없을 때).

    Pydantic 모델은 가변 객체이므로 공유 인스턴스 대신 매번 새로 만든다.
    """
    return Profile(
        name="My Archive", tagline="Things I keep returning to.", bio="", keywords=[]
    )


class Folder(CamelModel):
    """프론트 types/folder.ts TasteFolder."""

    id: str
    type: ContentType
    name: str
    cover_image_url: Optional[str] = None
    sort_order: int
    created_at: str


class Content(CamelModel):
    """프론트 types/content.ts TasteContent. (user_id는 M2 멀티유저에서 추가)"""

    id: str
    type: ContentType
    folder_id: Optional[str] = Field(default=None, description="null = 미분류")
    youtube_video_id: str
    source_title: str = ""
    source_channel: str = ""
    thumbnail_url: str = ""
    title: str = ""
    subtitle: str = ""
    body: str = ""
    sort_order: int
    created_at: str


class BootstrapResponse(CamelModel):
    """프론트 services/repository.ts RepoData — loadAll() 응답과 동일한 형태."""

    profile: Profile
    music_folders: list[Folder]
    video_folders: list[Folder]
    music_contents: list[Content]
    video_contents: list[Content]


# ── 쓰기 요청 스키마 ──
# id는 클라이언트가 생성한 UUID를 서버가 형식 검증 후 수용한다
# (프론트 컨텍스트의 동기 반환 계약 보존). created_at·sort_order는 서버 권위값.


class ProfileIn(Profile):
    """프로필 저장 요청 — 응답용 Profile과 달리 길이 제한을 강제한다.

    (응답 모델에 제한을 걸면 기존 저장값이 더 길 때 읽기가 깨질 수 있어 분리)
    """

    name: str = Field(default="", max_length=100)
    tagline: str = Field(default="", max_length=200)
    bio: str = Field(default="", max_length=2000)
    keywords: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("username")
    @classmethod
    def _normalize_username(cls, v: Optional[str]) -> Optional[str]:
        """소문자 정규화 + 형식·예약어 검증. 빈 값은 None(미설정)으로 취급."""
        if v is None:
            return None
        v = v.strip().lower()
        if v == "":
            return None
        if not _USERNAME_RE.match(v):
            raise ValueError("username은 영문 소문자·숫자·_·- 3~30자여야 합니다.")
        if v in _RESERVED_USERNAMES:
            raise ValueError("사용할 수 없는 username입니다.")
        return v


class FolderIn(CamelModel):
    """폴더 생성 요청."""

    id: UUID
    type: ContentType
    name: str = Field(min_length=1, max_length=100)
    # 커버는 base64 data URL일 수 있어 길이 제한을 두지 않는다(M4에서 Storage 이전).
    cover_image_url: Optional[str] = None


class FolderPatch(CamelModel):
    """폴더 수정 요청 — 보낸 필드만 반영(exclude_unset).

    coverImageUrl은 [필드 없음]=변경 안 함 / [null]=커버 제거 를 구분한다.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    cover_image_url: Optional[str] = None


class ContentIn(CamelModel):
    """콘텐츠 등록 요청."""

    id: UUID
    type: ContentType
    folder_id: Optional[str] = Field(default=None, description="null = 미분류")
    youtube_video_id: str = Field(min_length=1, max_length=32)
    source_title: str = Field(default="", max_length=300)
    source_channel: str = Field(default="", max_length=200)
    thumbnail_url: str = Field(default="", max_length=500)
    title: str = Field(default="", max_length=120)
    subtitle: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=2000)


class ContentPatch(CamelModel):
    """콘텐츠 수정 요청 — 사용자 작성 필드만(프론트 ContentPatch와 동일)."""

    title: Optional[str] = Field(default=None, max_length=120)
    subtitle: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=2000)


# ── LLM 문구추천 (M6) ──


class SuggestIn(CamelModel):
    """LLM 문구추천 요청. 모든 텍스트는 '데이터'로 취급되어 프롬프트에 격리된다."""

    type: ContentType
    source_title: str = Field(
        min_length=1, max_length=300, description="원본 영상/음악 제목"
    )
    source_channel: str = Field(default="", max_length=200, description="원본 채널명")
    note: str = Field(
        default="", max_length=500, description="사용자가 남긴 감상 메모(선택)"
    )


class SuggestResult(CamelModel):
    """LLM 문구추천 + 감성분석 응답 — 출력 검증·안전성 필터를 통과한 값만 담긴다."""

    taglines: list[str] = Field(
        description="추천 문구 후보(한국어, 각 24자 내외)",
        examples=[["밤에 스며드는 편지", "조용히 되감는 하루", "느린 위로"]],
    )
    mood: str = Field(description="분위기 한 단어", examples=["잔잔함"])
    keywords: list[str] = Field(
        default_factory=list,
        description="감상/취향을 나타내는 추천 키워드(프로필 키워드 후보)",
        examples=[["새벽", "위로", "잔잔"]],
    )
    tone: str = Field(
        default="", description="감상문에 어울리는 톤 제안", examples=["담백한"]
    )


# ── 이미지 업로드 (M4) ──


class UploadResult(CamelModel):
    """이미지 업로드 응답 — Storage 공개 URL. 폴더/프로필 저장 시 이 URL을 사용."""

    url: str = Field(
        description="업로드된 이미지의 공개 URL(coverImageUrl·profileImageUrl에 사용)",
        examples=["https://xxxx.supabase.co/storage/v1/object/public/images/<uid>/<id>.jpg"],
    )


# ── 찜(saves) — M7-A ──


class SaveIn(CamelModel):
    """찜 요청 — 찜할 콘텐츠 id."""

    content_id: UUID = Field(description="찜할 콘텐츠의 id")


# ── 취향 타임라인 (M8-A) ──


class TimelineBucket(CamelModel):
    """한 기간(월)의 콘텐츠 집계."""

    period: str = Field(description="기간(YYYY-MM)", examples=["2026-07"])
    total: int = Field(description="해당 기간 콘텐츠 수")
    music: int = Field(description="음악 수")
    video: int = Field(description="영상 수")


class TimelineResponse(CamelModel):
    """사용자 취향 타임라인 — 기간별 버킷(오름차순)."""

    username: str
    buckets: list[TimelineBucket]


# ── 유저-유저 취향 유사도 (M8-B 확장, G6) ──


class SimilarUser(CamelModel):
    """결이 비슷한 사용자 — 공유 채널·키워드와 점수."""

    username: str
    score: int = Field(description="유사도 점수(공유 채널·키워드 가중)")
    shared_channels: list[str] = Field(default_factory=list)
    shared_keywords: list[str] = Field(default_factory=list)


# ── 사용자 검색 (M10) ──


class UserSearchResult(CamelModel):
    """사용자 검색 후보 — 검색창 타이핑용 가벼운 목록(username·name만)."""

    username: str
    name: str = ""
