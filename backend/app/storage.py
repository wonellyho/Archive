"""Supabase Storage 이미지 업로드(M4).

service_role로 서버가 대신 업로드한다(키 은닉). 공개 버킷은 읽기 전용 공개,
쓰기는 서버만 가능. 파일 형식은 매직바이트로 검증해 content-type 스푸핑을 막는다.
"""

import uuid

import httpx
from fastapi import HTTPException

from .config import get_settings
from .http import get_client

# 허용 이미지: (매직바이트, content_type, 확장자). WEBP는 아래에서 별도 처리.
_MAGIC: list[tuple[bytes, str, str]] = [
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
]


def sniff_image(data: bytes) -> tuple[str, str] | None:
    """앞부분 바이트로 (content_type, ext)를 판별. 이미지가 아니면 None.

    클라이언트가 보낸 content-type을 신뢰하지 않고 실제 바이트로 검증한다.
    """
    for magic, content_type, ext in _MAGIC:
        if data.startswith(magic):
            return content_type, ext
    # WEBP: 'RIFF'....'WEBP'
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


async def upload_image(user_id: str, data: bytes, content_type: str, ext: str) -> str:
    """이미지를 공개 버킷에 올리고 공개 URL을 반환한다.

    경로는 서버가 생성한다(`{user_id}/{uuid}.{ext}`) — 클라이언트 파일명을 쓰지
    않아 경로 조작·덮어쓰기를 방지한다.
    """
    settings = get_settings()
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise HTTPException(503, "서버에 Storage 접속 정보가 설정되지 않았습니다.")

    base = settings.supabase_url.rstrip("/")
    bucket = settings.storage_bucket
    key = settings.supabase_service_role_key
    path = f"{user_id}/{uuid.uuid4().hex}.{ext}"

    try:
        resp = await get_client().post(
            f"{base}/storage/v1/object/{bucket}/{path}",
            content=data,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": content_type,
                "x-upsert": "false",  # 서버 생성 경로라 충돌 없음
            },
        )
    except httpx.HTTPError:
        raise HTTPException(502, "이미지 업로드에 실패했습니다.")

    if resp.status_code not in (200, 201):
        raise HTTPException(502, f"이미지 업로드 오류 (HTTP {resp.status_code}).")

    return f"{base}/storage/v1/object/public/{bucket}/{path}"
