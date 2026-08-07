"""slowapi 기반 전역 rate limit(per-IP). 공개·비용 발생 엔드포인트 남용 방지(M5).

- 키 = 클라이언트 IP(get_remote_address). 배포 시 프록시 뒤라면 X-Forwarded-For 신뢰 설정 필요(M9).
- LLM은 M6의 per-user 상한(`app/llm/ratelimit.py`)과 **2계층**으로 겹친다(defense in depth):
  per-user는 인증된 사용자 단위 공정성, per-IP는 인증 이전/익명 남용까지 차단.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# per-IP 분당 상한(초과 시 429). 데모 트래픽 기준 여유 있게.
LIMIT_BOOTSTRAP = "60/minute"  # 공개 초기 로드
LIMIT_SEARCH = "30/minute"  # YouTube 검색(할당량 보호)
LIMIT_LLM = "20/minute"  # LLM 호출(비용 보호) — per-user 상한과 병행
LIMIT_UPLOAD = "20/minute"  # 이미지 업로드(스토리지 남용 보호)
LIMIT_SAVES = "60/minute"  # 찜 저장/해제/목록(브라우징 중 잦을 수 있어 넉넉히)
LIMIT_PUBLIC = "60/minute"  # 공개 프로필 조회(/api/u/{username})
LIMIT_ACCOUNT_DELETE = "5/minute"  # 회원 탈퇴(영구 삭제, 되돌릴 수 없어 낮게)
LIMIT_HIGHLIGHTS = "60/minute"  # 하이라이트 조회/등록/수정/삭제

limiter = Limiter(key_func=get_remote_address)
