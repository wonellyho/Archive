"""Supabase(PostgREST) 데이터 접근 계층.

supabase-py는 동기 클라이언트라 FastAPI 이벤트 루프를 블로킹하므로,
httpx로 PostgREST REST API를 직접 호출한다.

- 읽기: anon 키로 충분(RLS 공개 읽기 정책). service_role이 설정돼 있으면 우선 사용.
- 쓰기: service_role 키 필요 — P3(쓰기 API)에서 사용.
- 참고: 이 계층은 소규모 프로젝트 실용성을 위해 HTTPException을 직접 던진다(계층 결합 수용).
"""

import asyncio
from typing import Any

import httpx
from fastapi import HTTPException

from .config import get_settings
from .http import get_client

# 프론트 storageService.ts 와 동일한 단일 프로필 ID (멀티유저는 M2에서)
PROFILE_ID = "me"


def _credentials() -> tuple[str, str]:
    """(base_url, api_key)를 반환한다. 미설정 시 503."""
    settings = get_settings()
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not (settings.supabase_url and key):
        raise HTTPException(503, "서버에 Supabase 접속 정보가 설정되지 않았습니다.")
    return f"{settings.supabase_url.rstrip('/')}/rest/v1", key


async def _select(
    base: str, key: str, table: str, params: dict[str, str]
) -> list[dict[str, Any]]:
    # PostgREST 기본 응답 상한(1000행) 이내 가정 — 초과 규모가 되면 M2에서 페이지네이션.
    try:
        resp = await get_client().get(
            f"{base}/{table}",
            params=params,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
    except httpx.HTTPError:
        raise HTTPException(502, "데이터베이스 요청에 실패했습니다.")
    if resp.status_code != 200:
        raise HTTPException(502, f"데이터베이스 조회 오류 (HTTP {resp.status_code}).")
    return resp.json()


# ── 쓰기 (service_role 필수) ──────────────────────────────────────────


def _write_credentials() -> tuple[str, str]:
    """쓰기용 (base_url, service_role_key). 미설정 시 503."""
    settings = get_settings()
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise HTTPException(
            503, "서버에 쓰기용 Supabase 키(service_role)가 설정되지 않았습니다."
        )
    return (
        f"{settings.supabase_url.rstrip('/')}/rest/v1",
        settings.supabase_service_role_key,
    )


async def _write(
    method: str,
    table: str,
    *,
    params: dict[str, str] | None = None,
    json: Any = None,
    prefer: str | None = None,
) -> Any:
    base, key = _write_credentials()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if prefer:
        headers["Prefer"] = prefer
    try:
        resp = await get_client().request(
            method, f"{base}/{table}", params=params, json=json, headers=headers
        )
    except httpx.HTTPError:
        raise HTTPException(502, "데이터베이스 요청에 실패했습니다.")
    if resp.status_code == 409:
        # 중복 PK(23505) 또는 FK 위반(23503) — 클라이언트 요청 문제로 구분
        raise HTTPException(409, "중복 ID이거나 참조(폴더)가 유효하지 않습니다.")
    if resp.status_code >= 300:
        raise HTTPException(502, f"데이터베이스 쓰기 오류 (HTTP {resp.status_code}).")
    return resp.json() if resp.content else None


async def upsert_profile(
    fields: dict[str, Any], user_id: str, username: str | None = None
) -> None:
    """현재 사용자의 프로필을 upsert(1인 1행) — M7-B 멀티유저.

    on_conflict=user_id 이므로 항상 '본인 행'만 대상(소유권 내재 — 남의 프로필 불가).
    id는 보내지 않는다: 신규는 DB 기본값(uuid), 기존 'me' 행은 id를 유지한다.
    username은 스키마에서 형식·예약어 검증됨(소문자 정규화). 여기선 타 사용자 중복만 확인.
    """
    base, key = _credentials()
    if username is not None:
        taken = await _select(
            base, key, "profiles", {"username": f"eq.{username}", "select": "user_id"}
        )
        if taken and taken[0].get("user_id") != user_id:
            raise HTTPException(409, "이미 사용 중인 username입니다.")

    payload: dict[str, Any] = {"user_id": user_id, **fields}
    if username is not None:
        payload["username"] = username
    await _write(
        "POST",
        "profiles",
        params={"on_conflict": "user_id"},
        json=payload,
        prefer="resolution=merge-duplicates",
    )


async def fetch_profile(user_id: str) -> dict[str, Any] | None:
    """현재 사용자(user_id)의 프로필 행을 조회. 없으면 None(신규 유저)."""
    base, key = _credentials()
    rows = await _select(
        base, key, "profiles", {"user_id": f"eq.{user_id}", "select": "*"}
    )
    return rows[0] if rows else None


async def fetch_public_archive(
    username: str,
) -> tuple[dict[str, Any], list[dict], list[dict]] | None:
    """username으로 공개 아카이브(프로필+폴더+콘텐츠)를 조회. 없으면 None."""
    base, key = _credentials()
    prof = await _select(
        base, key, "profiles", {"username": f"eq.{username}", "select": "*"}
    )
    if not prof:
        return None
    uid = prof[0].get("user_id")
    folders = await _select(
        base, key, "folders", {"user_id": f"eq.{uid}", "select": "*", "order": "sort_order.asc"}
    )
    contents = await _select(
        base, key, "contents", {"user_id": f"eq.{uid}", "select": "*", "order": "sort_order.asc"}
    )
    return prof[0], folders, contents


async def next_sort_order(table: str, content_type: str, user_id: str) -> int:
    """(user_id, type)별 다음 sort_order — 프론트 nextSortOrder(max+1)와 동일 규칙.

    멀티유저 대비 사용자별로 스코프한다(단일 사용자에선 기존과 동일 결과).
    """
    base, key = _credentials()
    rows = await _select(
        base,
        key,
        table,
        {
            "select": "sort_order",
            "user_id": f"eq.{user_id}",
            "type": f"eq.{content_type}",
            "order": "sort_order.desc",
            "limit": "1",
        },
    )
    return (rows[0]["sort_order"] + 1) if rows else 0


async def insert_row(table: str, row: dict[str, Any]) -> dict[str, Any]:
    """행 삽입 후 생성된 행(서버 권위 created_at 포함)을 반환한다.

    호출자는 row에 user_id(소유자)를 포함해야 한다(스키마 NOT NULL).
    """
    created = await _write("POST", table, json=row, prefer="return=representation")
    return created[0]


async def patch_row(
    table: str, row_id: str, fields: dict[str, Any], user_id: str
) -> None:
    """소유자 행만 수정 — id와 user_id로 스코프(타인 행이면 0행 영향)."""
    await _write(
        "PATCH",
        table,
        params={"id": f"eq.{row_id}", "user_id": f"eq.{user_id}"},
        json=fields,
    )


async def delete_rows(table: str, column: str, value: str, user_id: str) -> None:
    """소유자 행만 삭제 — 필터 컬럼과 user_id로 스코프."""
    await _write(
        "DELETE",
        table,
        params={column: f"eq.{value}", "user_id": f"eq.{user_id}"},
    )


# ── 찜(saves) — M7-A ──────────────────────────────────────────────────


async def add_save(user_id: str, content_id: str) -> None:
    """찜 추가(멱등). 이미 찜했으면 무시, 없는 콘텐츠(FK 위반)면 404.

    service_role은 RLS를 우회하므로 user_id를 백엔드가 직접 스탬프한다.
    """
    base, key = _write_credentials()
    try:
        resp = await get_client().post(
            f"{base}/saves",
            params={"on_conflict": "user_id,content_id"},
            json={"user_id": user_id, "content_id": content_id},
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Prefer": "return=minimal,resolution=ignore-duplicates",
            },
        )
    except httpx.HTTPError:
        raise HTTPException(502, "데이터베이스 요청에 실패했습니다.")
    if resp.status_code < 300:
        return
    if resp.status_code == 409:
        # 중복은 ignore-duplicates로 흡수되므로 409 = 존재하지 않는 content_id(FK).
        raise HTTPException(404, "콘텐츠를 찾을 수 없습니다.")
    raise HTTPException(502, f"데이터베이스 쓰기 오류 (HTTP {resp.status_code}).")


async def remove_save(user_id: str, content_id: str) -> None:
    """찜 해제 — 본인 것만(user_id 스코프). 없으면 0행(무해)."""
    await _write(
        "DELETE",
        "saves",
        params={"user_id": f"eq.{user_id}", "content_id": f"eq.{content_id}"},
    )


async def list_saved_contents(user_id: str) -> list[dict[str, Any]]:
    """내가 찜한 콘텐츠 목록(찜한 최신순). saves→contents 임베드 조회."""
    base, key = _credentials()
    rows = await _select(
        base,
        key,
        "saves",
        {
            "user_id": f"eq.{user_id}",
            "select": "created_at,contents(*)",
            "order": "created_at.desc",
        },
    )
    return [row["contents"] for row in rows if row.get("contents")]


# ── 유사 콘텐츠 추천 (M8-B) ───────────────────────────────────────────


async def fetch_similar_pool(
    content_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]] | None:
    """대상 콘텐츠 + 후보(같은 채널 또는 같은 타입)를 조회. 없으면 None.

    랭킹(점수화·정렬)은 라우터의 순수 함수 rank_similar에서 수행한다.
    공개 읽기 정책이라 후보는 전체 사용자 콘텐츠(멀티유저 시 교차 발견).
    """
    base, key = _credentials()
    target_rows = await _select(
        base, key, "contents", {"id": f"eq.{content_id}", "select": "id,type,source_channel"}
    )
    if not target_rows:
        return None
    target = target_rows[0]

    same_type = await _select(
        base, key, "contents", {"type": f"eq.{target.get('type')}", "select": "*"}
    )
    channel = target.get("source_channel") or ""
    same_channel: list[dict] = []
    if channel:
        same_channel = await _select(
            base, key, "contents", {"source_channel": f"eq.{channel}", "select": "*"}
        )

    merged: dict[str, dict] = {row["id"]: row for row in same_type}
    for row in same_channel:
        merged[row["id"]] = row
    return target, list(merged.values())


# ── 유저-유저 취향 유사도 (G6) ────────────────────────────────────────


async def fetch_user_taste_pool(
    username: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]] | None:
    """(기준 사용자 특징, 다른 사용자들 특징) 반환. 없으면 None.

    특징 = {username, channels(set), keywords(set)}. 채널은 콘텐츠 source_channel,
    키워드는 프로필 keywords. 랭킹은 라우터의 순수 함수에서.
    """
    from collections import defaultdict

    base, key = _credentials()
    profiles = await _select(
        base,
        key,
        "profiles",
        {"select": "user_id,username,keywords", "username": "not.is.null"},
    )
    contents = await _select(
        base, key, "contents", {"select": "user_id,source_channel"}
    )

    channels_by_user: dict[str, set[str]] = defaultdict(set)
    for row in contents:
        channel = row.get("source_channel")
        if channel:
            channels_by_user[row.get("user_id")].add(channel)

    reference: dict[str, Any] | None = None
    others: list[dict[str, Any]] = []
    for prof in profiles:
        feature = {
            "username": prof.get("username"),
            "channels": channels_by_user.get(prof.get("user_id"), set()),
            "keywords": set(prof.get("keywords") or []),
        }
        if prof.get("username") == username:
            reference = feature
        else:
            others.append(feature)

    if reference is None:
        return None
    return reference, others


# ── 취향 타임라인 (M8-A) ──────────────────────────────────────────────


async def fetch_timeline_rows(username: str) -> list[dict[str, Any]] | None:
    """username 사용자의 콘텐츠 (created_at, type)만 조회. 없으면 None.

    집계(월별 버킷)는 라우터에서 수행한다(데이터 소량 기준; 대규모는 후속 RPC).
    """
    base, key = _credentials()
    prof = await _select(
        base, key, "profiles", {"username": f"eq.{username}", "select": "user_id"}
    )
    if not prof:
        return None
    uid = prof[0].get("user_id")
    return await _select(
        base,
        key,
        "contents",
        {"user_id": f"eq.{uid}", "select": "created_at,type", "order": "created_at.asc"},
    )


# ── 사용자 검색 (M10, #54) ────────────────────────────────────────────


async def fetch_searchable_users() -> list[dict[str, Any]]:
    """검색 대상 후보(username이 있는 유저만) 조회. username·name만 select.

    부분 일치 로직은 라우터의 순수 함수(rank_users)에서 수행한다. PostgREST
    ilike는 `%`·`_`·`*`를 사용자 입력에서 그대로 받으면 와일드카드 주입 위험이
    있어, 패턴 매칭 대신 전체 후보를 가져와 앱에서 비교한다.

    `_select`와 동일하게 PostgREST 기본 응답 상한(1000행) 이내를 가정한다 —
    가입자가 그 이상으로 늘면 이 함수도 truncate되어 뒤쪽 사용자가 검색에서
    누락될 수 있다(소규모 사용자 기준으로 채택한 트레이드오프, 대규모가 되면
    전용 검색 인덱스/페이지네이션으로 전환 필요).
    """
    base, key = _credentials()
    return await _select(
        base, key, "profiles", {"select": "username,name", "username": "not.is.null"}
    )


# ── 회원 탈퇴 (M14, #59) ──────────────────────────────────────────────


async def delete_all_owned_rows(user_id: str) -> None:
    """탈퇴 유저가 소유한 앱 데이터를 전부 삭제(profiles·folders·contents·saves).

    `content_tags`는 contents(id) FK가 on delete cascade라 contents 삭제 시
    자동 정리됨(별도 호출 불필요). auth.users 삭제(`delete_auth_user`)보다
    반드시 먼저 호출해야 한다(계정이 없어지면 이 함수가 사용하는 user_id로
    더 이상 스코프할 수 없음).

    4개 테이블은 서로 의존관계가 없어(각자 user_id로만 스코프) `fetch_bootstrap`과
    동일하게 `asyncio.gather`로 병렬 실행한다. `return_exceptions=True`로 하나가
    실패해도 나머지는 계속 시도한다 — 각 DELETE는 멱등(이미 없는 행 삭제는 무해)이라,
    실패 후 이 함수를 다시 호출하면 남은 테이블만 마저 정리되고 이미 지워진
    테이블은 그대로 스킵된다(자연스러운 재시도 안전성).
    """
    results = await asyncio.gather(
        _write("DELETE", "contents", params={"user_id": f"eq.{user_id}"}),
        _write("DELETE", "folders", params={"user_id": f"eq.{user_id}"}),
        _write("DELETE", "saves", params={"user_id": f"eq.{user_id}"}),
        _write("DELETE", "profiles", params={"user_id": f"eq.{user_id}"}),
        return_exceptions=True,
    )
    for result in results:
        if isinstance(result, BaseException):
            raise result


async def delete_auth_user(user_id: str) -> None:
    """GoTrue Admin API로 Supabase Auth 계정 자체를 삭제한다(service_role 필수).

    `/rest/v1`이 아니라 `/auth/v1/admin`이라 `_write_credentials()`의 REST 기준
    base URL에서 접미사만 떼어 재사용한다(키 존재 검증 로직 중복 방지).
    """
    rest_base, key = _write_credentials()
    base = rest_base.removesuffix("/rest/v1")
    try:
        resp = await get_client().delete(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
    except httpx.HTTPError:
        raise HTTPException(502, "계정 삭제 요청에 실패했습니다.")
    # 404 = 이미 삭제된 계정(응답 유실 후 재시도 등) — 목표 상태에 도달했으므로
    # 성공으로 간주한다(멱등). 그 외 비정상 상태 코드만 실패로 처리.
    if resp.status_code not in (200, 204, 404):
        raise HTTPException(502, f"계정 삭제 오류 (HTTP {resp.status_code}).")


# ── 콘텐츠 태그 (M13) ─────────────────────────────────────────────────


async def fetch_content(content_id: str) -> dict[str, Any] | None:
    """콘텐츠 전체 행 조회(태그 소유권 확인 + LLM 자동 태깅 입력에 사용). 없으면 None."""
    base, key = _credentials()
    rows = await _select(base, key, "contents", {"id": f"eq.{content_id}", "select": "*"})
    return rows[0] if rows else None


async def list_tags() -> list[dict[str, Any]]:
    """태그 마스터 전체 목록(이름순) — 자동완성/드롭다운용."""
    base, key = _credentials()
    return await _select(base, key, "tags", {"select": "*", "order": "name.asc"})


async def list_content_tags(content_id: str) -> list[dict[str, Any]]:
    """특정 콘텐츠에 달린 태그 목록. content_tags→tags 임베드 조회."""
    base, key = _credentials()
    rows = await _select(
        base,
        key,
        "content_tags",
        {"content_id": f"eq.{content_id}", "select": "tags(*)"},
    )
    return [row["tags"] for row in rows if row.get("tags")]


async def require_content_owner(content_id: str, user_id: str) -> dict[str, Any]:
    """콘텐츠를 조회하고 소유권을 검증한다. 없으면 404, 소유자가 아니면 403.

    태그 관련 엔드포인트(추가·제거·자동추천) 3곳이 공유하는 소유권 확인 지점.
    """
    content = await fetch_content(content_id)
    if content is None:
        raise HTTPException(404, "콘텐츠를 찾을 수 없습니다.")
    if content.get("user_id") != user_id:
        raise HTTPException(403, "본인 콘텐츠에만 이 작업을 할 수 있습니다.")
    return content


async def _find_or_create_tag(name: str) -> dict[str, Any]:
    """이름(대소문자·공백 무시)으로 태그를 찾고, 없으면 새로 만든다.

    ilike 와일드카드(%·_·PostgREST의 * 대체문자) 주입을 원천 차단하기 위해
    패턴 매칭 대신 전체 태그를 가져와 앱에서 비교한다(소규모 마스터 목록 기준
    — 대규모가 되면 전용 조회 뷰/RPC로 전환). 동시 생성 경합 시(유일 인덱스
    위반 409) 재조회로 자체 복구한다(락 대신 재시도).
    """
    normalized = name.strip().lower()
    base, key = _credentials()

    async def _lookup() -> dict[str, Any] | None:
        all_tags = await _select(base, key, "tags", {"select": "*"})
        for row in all_tags:
            if (row.get("name") or "").strip().lower() == normalized:
                return row
        return None

    existing = await _lookup()
    if existing:
        return existing
    try:
        created = await _write(
            "POST", "tags", json={"name": name.strip()}, prefer="return=representation"
        )
        return created[0]
    except HTTPException as exc:
        if exc.status_code == 409:
            existing = await _lookup()
            if existing:
                return existing
        raise


async def add_content_tag(content_id: str, tag_name: str, user_id: str) -> dict[str, Any]:
    """콘텐츠에 태그를 연결(소유자만). 마스터에 없는 이름이면 새로 생성.

    이미 연결된 태그면 멱등(ignore-duplicates).
    """
    await require_content_owner(content_id, user_id)
    tag = await _find_or_create_tag(tag_name)
    await _write(
        "POST",
        "content_tags",
        params={"on_conflict": "content_id,tag_id"},
        json={"content_id": content_id, "tag_id": tag["id"]},
        prefer="return=minimal,resolution=ignore-duplicates",
    )
    return tag


async def remove_content_tag(content_id: str, tag_id: str, user_id: str) -> None:
    """콘텐츠에서 태그 연결을 제거(소유자만). 연결이 없어도 무해(0행)."""
    await require_content_owner(content_id, user_id)

    await _write(
        "DELETE",
        "content_tags",
        params={"content_id": f"eq.{content_id}", "tag_id": f"eq.{tag_id}"},
    )


async def fetch_bootstrap() -> tuple[dict[str, Any] | None, list[dict], list[dict]]:
    """프로필(단일)·폴더·콘텐츠를 병렬 조회한다.

    프론트 supabaseRepository.loadAll()의 3쿼리 병렬 호출과 동일한 동작.
    return_exceptions=True로 세 태스크의 완료를 모두 기다린 뒤 첫 예외를
    재던진다(중간 실패 시 백그라운드 태스크 노이즈 방지).
    """
    base, key = _credentials()
    results = await asyncio.gather(
        _select(base, key, "profiles", {"id": f"eq.{PROFILE_ID}", "select": "*"}),
        _select(base, key, "folders", {"select": "*", "order": "sort_order.asc"}),
        _select(base, key, "contents", {"select": "*", "order": "sort_order.asc"}),
        return_exceptions=True,
    )
    for result in results:
        if isinstance(result, BaseException):
            raise result
    profile_rows, folder_rows, content_rows = results

    profile_row = profile_rows[0] if profile_rows else None
    return profile_row, folder_rows, content_rows
