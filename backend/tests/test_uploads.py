"""이미지 업로드 API(M4) 테스트 — Storage 업로드는 모킹, 네트워크 없음.

커버: 인증(401)·성공(모킹)·비이미지(400)·빈 파일(400)·용량 초과(413)
+ 매직바이트 판별 단위 테스트.
"""

import asyncio

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import storage
from app.config import get_settings
from app.deps import CurrentUser, get_current_user
from app.main import app

from ._http_fakes import FakeAsyncClient, FakeResponse

client = TestClient(app)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32  # 유효 PNG 매직 + 더미


@pytest.fixture
def authed():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="test-user")
    yield
    app.dependency_overrides.clear()


def _files(data: bytes, name="x.png", ctype="image/png"):
    return {"file": (name, data, ctype)}


# ── 인증 게이트 ──


def test_requires_auth():
    resp = client.post("/api/uploads", files=_files(PNG))
    assert resp.status_code == 401


# ── 성공(모킹) ──


def test_success_returns_public_url(authed, monkeypatch):
    captured = {}

    async def fake_upload(user_id, data, content_type, ext):
        captured.update(user_id=user_id, content_type=content_type, ext=ext, size=len(data))
        return "https://x.supabase.co/storage/v1/object/public/images/u/abc.png"

    monkeypatch.setattr(storage, "upload_image", fake_upload)
    resp = client.post("/api/uploads", files=_files(PNG))
    assert resp.status_code == 200
    assert resp.json()["url"].endswith("/abc.png")
    # 서버는 매직바이트로 판별한 값을 사용(클라 content-type 불신)
    assert captured == {
        "user_id": "test-user",
        "content_type": "image/png",
        "ext": "png",
        "size": len(PNG),
    }


def test_content_type_spoof_corrected_by_magic_bytes(authed, monkeypatch):
    seen = {}

    async def fake_upload(user_id, data, content_type, ext):
        seen["content_type"] = content_type
        return "https://x/y.png"

    monkeypatch.setattr(storage, "upload_image", fake_upload)
    # 실제 PNG인데 클라가 image/jpeg라고 우겨도 → png로 판별
    resp = client.post("/api/uploads", files=_files(PNG, "x.jpg", "image/jpeg"))
    assert resp.status_code == 200
    assert seen["content_type"] == "image/png"


# ── 검증 ──


def test_non_image_returns_400(authed):
    resp = client.post("/api/uploads", files=_files(b"this is not an image"))
    assert resp.status_code == 400


def test_empty_file_returns_400(authed):
    resp = client.post("/api/uploads", files=_files(b""))
    assert resp.status_code == 400


def test_oversized_file_returns_413(authed, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_bytes", 10)
    resp = client.post("/api/uploads", files=_files(PNG))  # 40바이트 > 10
    assert resp.status_code == 413


# ── 매직바이트 판별(단위) ──


@pytest.mark.parametrize(
    "data,expected",
    [
        (b"\xff\xd8\xff\xe0\x00\x10JFIF", ("image/jpeg", "jpg")),
        (b"\x89PNG\r\n\x1a\n....", ("image/png", "png")),
        (b"GIF89a....", ("image/gif", "gif")),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", ("image/webp", "webp")),
        (b"%PDF-1.4 not image", None),
        (b"", None),
    ],
)
def test_sniff_image(data, expected):
    assert storage.sniff_image(data) == expected


# ── storage.upload_image 자체 (httpx 모킹, 라우터 우회) ──
# 위 라우터 테스트들은 storage.upload_image를 통째로 모킹해서 쓰기 때문에,
# 실제 업로드 함수(경로 생성·httpx 호출·에러 매핑)는 여기서 직접 검증한다.


@pytest.fixture
def storage_configured():
    settings = get_settings()
    orig = (settings.supabase_url, settings.supabase_service_role_key)
    settings.supabase_url = "https://fake.supabase.co"
    settings.supabase_service_role_key = "fake-service-role-key"
    yield
    settings.supabase_url, settings.supabase_service_role_key = orig


def test_upload_image_missing_config_returns_503(monkeypatch):
    settings = get_settings()
    orig_url = settings.supabase_url
    settings.supabase_url = ""
    try:
        with pytest.raises(HTTPException) as exc:
            asyncio.run(storage.upload_image("u1", PNG, "image/png", "png"))
        assert exc.value.status_code == 503
    finally:
        settings.supabase_url = orig_url


def test_upload_image_success_uses_server_generated_path(storage_configured, monkeypatch):
    captured = {}

    def responder(method, url, **kwargs):
        captured.update(method=method, url=url, headers=kwargs.get("headers"))
        return FakeResponse(200)

    monkeypatch.setattr(storage, "get_client", lambda: FakeAsyncClient(responder))
    url = asyncio.run(storage.upload_image("u1", PNG, "image/png", "png"))

    assert captured["method"] == "POST"
    # 경로가 {user_id}/{uuid}.{ext} 형태로 서버에서 생성되어야 한다(클라 파일명 미사용).
    assert "/storage/v1/object/images/u1/" in captured["url"]
    assert captured["url"].endswith(".png")
    assert url.startswith("https://fake.supabase.co/storage/v1/object/public/images/u1/")


def test_upload_image_upstream_error_returns_502(storage_configured, monkeypatch):
    monkeypatch.setattr(
        storage, "get_client", lambda: FakeAsyncClient(lambda m, u, **kw: FakeResponse(500))
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(storage.upload_image("u1", PNG, "image/png", "png"))
    assert exc.value.status_code == 502


def test_upload_image_network_error_returns_502(storage_configured, monkeypatch):
    def responder(method, url, **kwargs):
        return httpx.ConnectError("boom")

    monkeypatch.setattr(storage, "get_client", lambda: FakeAsyncClient(responder))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(storage.upload_image("u1", PNG, "image/png", "png"))
    assert exc.value.status_code == 502
