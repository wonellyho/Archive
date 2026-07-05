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


async def upsert_profile(fields: dict[str, Any], user_id: str) -> None:
    """단일 프로필(id=me) upsert — 소유자만 수정 가능.

    service_role은 RLS를 우회하므로 백엔드가 직접 소유권을 확인한다:
    프로필이 이미 다른 사용자 소유면 403, 그 외엔 user_id를 스탬프해 upsert.
    """
    base, key = _credentials()
    existing = await _select(
        base, key, "profiles", {"id": f"eq.{PROFILE_ID}", "select": "user_id"}
    )
    if existing:
        owner = existing[0].get("user_id")
        if owner is not None and owner != user_id:
            raise HTTPException(403, "다른 사용자의 프로필은 수정할 수 없습니다.")
    await _write(
        "POST",
        "profiles",
        params={"on_conflict": "id"},
        json={"id": PROFILE_ID, "user_id": user_id, **fields},
        prefer="resolution=merge-duplicates",
    )


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
