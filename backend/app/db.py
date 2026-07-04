"""Supabase(PostgREST) 데이터 접근 계층.

supabase-py는 동기 클라이언트라 FastAPI 이벤트 루프를 블로킹하므로,
httpx로 PostgREST REST API를 직접 호출한다.

- 읽기: anon 키로 충분(RLS 공개 읽기 정책). service_role이 설정돼 있으면 우선 사용.
- 쓰기: service_role 키 필요 — P3(쓰기 API)에서 사용.
"""

import asyncio
from typing import Any

import httpx
from fastapi import HTTPException

from .config import get_settings

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
    client: httpx.AsyncClient, base: str, key: str, table: str, params: dict[str, str]
) -> list[dict[str, Any]]:
    try:
        resp = await client.get(
            f"{base}/{table}",
            params=params,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
    except httpx.HTTPError:
        raise HTTPException(502, "데이터베이스 요청에 실패했습니다.")
    if resp.status_code != 200:
        raise HTTPException(502, f"데이터베이스 조회 오류 (HTTP {resp.status_code}).")
    return resp.json()


async def fetch_bootstrap() -> tuple[dict[str, Any] | None, list[dict], list[dict]]:
    """프로필(단일)·폴더·콘텐츠를 병렬 조회한다.

    프론트 supabaseRepository.loadAll()의 3쿼리 병렬 호출과 동일한 동작.
    """
    base, key = _credentials()
    async with httpx.AsyncClient(timeout=10) as client:
        profile_rows, folder_rows, content_rows = await asyncio.gather(
            _select(client, base, key, "profiles", {"id": f"eq.{PROFILE_ID}", "select": "*"}),
            _select(client, base, key, "folders", {"select": "*", "order": "sort_order.asc"}),
            _select(client, base, key, "contents", {"select": "*", "order": "sort_order.asc"}),
        )
    profile_row = profile_rows[0] if profile_rows else None
    return profile_row, folder_rows, content_rows
