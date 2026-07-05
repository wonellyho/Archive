"""이미지 업로드(M4). 프론트의 base64 data URL 저장을 Storage URL로 대체한다.

보안: 인증 게이트 · 타입 allowlist(매직바이트) · 크기 상한 · rate limit ·
서버 생성 경로. Storage 쓰기 키(service_role)는 서버에만 있다.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from .. import storage
from ..config import get_settings
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_UPLOAD, limiter
from ..schemas import UploadResult

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

_ERROR_RESPONSES = {
    400: {"description": "빈 파일이거나 지원하지 않는 이미지 형식."},
    401: {"description": "인증 실패 — 로그인 토큰 필요."},
    413: {"description": "이미지 용량 초과."},
    429: {"description": "업로드가 너무 잦음 — 잠시 후 재시도."},
    502: {"description": "Storage 업로드 오류."},
    503: {"description": "서버 Storage 설정 미비."},
}


@router.post(
    "",
    response_model=UploadResult,
    summary="이미지 업로드 🔒",
    response_description="업로드된 이미지의 공개 URL",
    responses=_ERROR_RESPONSES,
    description=(
        "이미지 파일(multipart `file`)을 업로드하고 공개 URL을 반환합니다. "
        "허용 형식은 JPEG/PNG/WEBP/GIF이며, 서버가 매직바이트로 실제 형식을 검증합니다. "
        "반환된 URL을 폴더 `coverImageUrl`·프로필 `profileImageUrl`에 저장하세요."
    ),
)
@limiter.limit(LIMIT_UPLOAD)
async def upload_image(
    request: Request,
    file: UploadFile = File(..., description="이미지 파일(JPEG/PNG/WEBP/GIF)"),
    user: CurrentUser = Depends(get_current_user),
) -> UploadResult:
    settings = get_settings()

    # 크기 상한: 상한+1 바이트까지만 읽어 초과 여부를 판단(과대 파일 메모리 방어).
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(413, f"이미지가 너무 큽니다(최대 {limit_mb}MB).")
    if not data:
        raise HTTPException(400, "빈 파일입니다.")

    sniffed = storage.sniff_image(data)
    if sniffed is None:
        raise HTTPException(400, "지원하지 않는 이미지 형식입니다(JPEG/PNG/WEBP/GIF).")
    content_type, ext = sniffed

    url = await storage.upload_image(user.id, data, content_type, ext)
    return UploadResult(url=url)
