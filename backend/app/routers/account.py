"""회원 탈퇴 — 계정 영구 삭제(M14, #59).

소유 데이터(profiles·folders·contents·saves)를 먼저 삭제한 뒤 Supabase Auth
계정(auth.users) 자체를 GoTrue Admin API로 제거한다. 되돌릴 수 없다.
"""

from fastapi import APIRouter, Depends, Request

from .. import db
from ..deps import CurrentUser, get_current_user
from ..limiter import LIMIT_ACCOUNT_DELETE, limiter

router = APIRouter(prefix="/api", tags=["account"])


@router.delete(
    "/me",
    status_code=204,
    summary="회원 탈퇴 (계정 영구 삭제) 🔒",
    response_description="탈퇴 완료(본문 없음). 되돌릴 수 없습니다.",
    responses={
        401: {"description": "인증 실패 — 로그인 토큰 필요."},
        429: {"description": "요청이 너무 잦음(분당 상한 초과)."},
        503: {"description": "서버 쓰기 키(service_role) 미설정."},
    },
    description=(
        "본인 계정을 영구 삭제합니다. 프로필·폴더·콘텐츠·찜을 먼저 삭제한 뒤 "
        "Supabase Auth 계정 자체를 제거합니다. **소프트 삭제가 아니며 즉시 영구 삭제**되어 "
        "복구할 수 없습니다."
    ),
)
@limiter.limit(LIMIT_ACCOUNT_DELETE)
async def delete_account(
    request: Request, user: CurrentUser = Depends(get_current_user)
) -> None:
    # 순서 중요: 계정(auth.users)을 먼저 지우면 이후 user_id로 소유 데이터를
    # 스코프할 근거(로그인 자체)가 사라지므로, 앱 데이터부터 지운다.
    await db.delete_all_owned_rows(user.id)
    await db.delete_auth_user(user.id)
