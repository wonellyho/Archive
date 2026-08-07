"""콘텐츠 태그(M13) — 자동(LLM) + 수동 태깅.

`tags` 마스터 테이블 + `content_tags` 다대다를 자동 태깅과 수동 선택이 함께 쓴다.
읽기는 공개, 쓰기(추가·삭제·LLM 추천)는 콘텐츠 소유자만.
"""

from fastapi import APIRouter, Depends, Request

from .. import db
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_LLM, LIMIT_PUBLIC, LIMIT_SAVES, limiter
from ..llm import get_provider
from ..llm.guard import run_guarded
from ..schemas import Tag, TagIn, TagSuggestResult

router = APIRouter(prefix="/api", tags=["tags"])

_OWNER_ERRORS = {
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    403: {"description": "본인 콘텐츠가 아님."},
    404: {"description": "콘텐츠를 찾을 수 없음."},
    503: {"description": "서버 쓰기 키(service_role) 미설정."},
}

_SUGGEST_ERRORS = {
    **_OWNER_ERRORS,
    429: {"description": "호출이 너무 잦거나 LLM 사용량 초과 — 잠시 후 재시도."},
    502: {"description": "LLM 업스트림 오류 또는 출력 검증 실패 — 잠시 후 재시도."},
}


@router.get(
    "/tags",
    response_model=list[Tag],
    summary="태그 마스터 목록",
    response_description="전체 태그(이름순)",
    description="자동완성/드롭다운용 태그 마스터 목록입니다(인증 불필요).",
)
@limiter.limit(LIMIT_PUBLIC)
async def list_tags(request: Request) -> list[Tag]:
    rows = await db.list_tags()
    return [Tag(**row) for row in rows]


@router.get(
    "/contents/{content_id}/tags",
    response_model=list[Tag],
    summary="콘텐츠 태그 조회",
    response_description="해당 콘텐츠에 달린 태그 목록",
    description="특정 콘텐츠에 달린 태그를 조회합니다(인증 불필요, 방문자도 조회 가능).",
)
@limiter.limit(LIMIT_PUBLIC)
async def content_tags(request: Request, content_id: str) -> list[Tag]:
    rows = await db.list_content_tags(content_id)
    return [Tag(**row) for row in rows]


@router.post(
    "/contents/{content_id}/tags/suggest",
    response_model=TagSuggestResult,
    summary="LLM 자동 태깅 후보 생성 🔒",
    response_description="추천 태그 후보(저장 안 됨)",
    responses=_SUGGEST_ERRORS,
    description=(
        "콘텐츠의 제목·채널·메모를 바탕으로 태그 후보를 추천합니다(저장하지 않음). "
        "확정하려면 `POST /api/contents/{content_id}/tags`로 원하는 후보를 추가하세요. "
        "입력은 서버가 조회한 콘텐츠 데이터이며 인젝션 방어·출력 검증은 문구추천(M6)과 동일합니다."
    ),
)
@limiter.limit(LIMIT_LLM)
async def suggest_content_tags(
    request: Request, content_id: str, user: CurrentUser = Depends(get_current_user)
) -> TagSuggestResult:
    content = await db.require_content_owner(content_id, user.id)
    tags = await run_guarded(
        user.id,
        lambda: get_provider().suggest_tags(content),
        error_message="태그 추천 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return TagSuggestResult(tags=tags)


@router.post(
    "/contents/{content_id}/tags",
    status_code=201,
    response_model=Tag,
    summary="태그 추가 🔒",
    response_description="연결된 태그(신규 생성 또는 기존 태그)",
    responses=_OWNER_ERRORS,
    description=(
        "콘텐츠에 태그를 연결합니다(자동 후보 확정 또는 수동 입력 모두 동일 엔드포인트). "
        "마스터에 없는 이름이면 새로 생성합니다(대소문자 무시 중복 방지). 이미 연결된 태그면 멱등."
    ),
)
@limiter.limit(LIMIT_SAVES)
async def add_tag(
    request: Request,
    content_id: str,
    body: TagIn,
    user: CurrentUser = Depends(get_current_user),
) -> Tag:
    tag = await db.add_content_tag(content_id, body.name, user.id)
    return Tag(**tag)


@router.delete(
    "/contents/{content_id}/tags/{tag_id}",
    status_code=204,
    summary="태그 제거 🔒",
    response_description="제거 성공(본문 없음). 연결이 없던 경우도 204.",
    responses=_OWNER_ERRORS,
)
@limiter.limit(LIMIT_SAVES)
async def remove_tag(
    request: Request,
    content_id: str,
    tag_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    await db.remove_content_tag(content_id, tag_id, user.id)
