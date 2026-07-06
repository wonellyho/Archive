# Archive Backend (FastAPI)

개인 취향 아카이빙 서비스 **Archive**의 백엔드. 프론트엔드(React)에 내장돼 있던
외부 API 호출·데이터 접근 로직을 독립 백엔드로 이관한 서버다.

- 프레임워크: FastAPI (Python 3.12)
- 인증: Supabase JWT 검증 (ECC P-256 / ES256 → JWKS 공개키)
- DB / 인증 / 스토리지: Supabase (교체 아님, 유지)
- 배포(예정): Railway / Render

## 요구 사항
- Python 3.12+

## 초기 실행

```bash
cd backend

# 1) 가상환경 (이름은 archive — 다른 이름도 가능, .gitignore가 archive/·venv/·.venv/ 모두 무시)
python -m venv archive
#  Windows PowerShell:   archive\Scripts\Activate.ps1
#  Windows Git Bash:     source archive/Scripts/activate
#  macOS / Linux:        source archive/bin/activate

# 2) 의존성 설치
pip install -r requirements.txt

# 3) 환경변수 준비 (.env.example의 주석대로 값 채우기)
cp .env.example .env       # Windows: copy .env.example .env

# 4) 실행
uvicorn app.main:app --reload --port 8001

# 테스트 (네트워크 없이 모킹 — 항상 통과해야 함)
python -m pytest -q
```

- 헬스체크: <http://localhost:8001/health>
- API 문서(Swagger): <http://localhost:8001/docs>
- 포트 **8001** (8000은 다른 로컬 서비스와 충돌 회피)

## 환경변수 요약
자세한 건 `.env.example` 주석 참고. 기능별로 필요한 값:

| 값 | 필요 시점 |
|---|---|
| `SUPABASE_URL` | 필수(JWT 검증·DB) |
| `SUPABASE_ANON_KEY` | 공개 읽기 |
| `SUPABASE_SERVICE_ROLE_KEY` | **쓰기**(프로필·폴더·콘텐츠·찜·업로드) — 서버 전용 비밀 |
| `YOUTUBE_API_KEY` | YouTube 검색 |
| `ANTHROPIC_API_KEY` | **LLM 문구추천**(`/api/llm/suggest`) |
| `STORAGE_BUCKET`(기본 `images`) | **이미지 업로드** — Supabase에 공개 버킷 `images` 필요(`docs/supabase-setup.md §1-1`) |
| `AUTH_OPTIONAL=true` | 로컬에서 토큰 없이 테스트(배포 금지). ⚠️ 마이그레이션 후 **쓰기는 실토큰 필요**(FK) |

> DB 스키마·버킷·마이그레이션: `docs/supabase-setup.md`. API 계약: `docs/API_명세.md` 또는 `/docs`.

## 엔드포인트 (18)
> `/api` 프리픽스. 🔒=JWT 필요(토큰 `sub`로 유저 식별, user_id 입력 없음). 나머지 공개.

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| GET | `/health` | 서버 상태 | 공개 |
| GET | `/api/bootstrap` | 초기 전체 로드(홈: 프로필+폴더+콘텐츠) | 공개 |
| GET | `/api/youtube/search` | YouTube 검색 프록시(키 은닉) | 🔒 |
| GET | `/api/me` | 내 프로필 조회 | 🔒 |
| PUT | `/api/profile` | 프로필 저장(유저별, username) | 🔒 |
| POST·PATCH·DELETE | `/api/folders[/{id}]` | 폴더 CRUD(소유권 스코프) | 🔒 |
| POST·PATCH·DELETE | `/api/contents[/{id}]` | 콘텐츠 CRUD(소유권 스코프) | 🔒 |
| POST | `/api/llm/suggest` | LLM 문구추천(4계층 방어) | 🔒 |
| POST | `/api/uploads` | 이미지 업로드(Storage, 매직바이트) | 🔒 |
| GET·POST·DELETE | `/api/saves[/{contentId}]` | 찜(본인만·멱등) | 🔒 |
| GET | `/api/u/{username}` | 공개 아카이브 | 공개 |
| GET | `/api/timeline/{username}` | 취향 타임라인(월별) | 공개 |
| GET | `/api/discover/similar/{contentId}` | 유사 콘텐츠 추천 | 공개 |

> rate limit(per-IP, 분당): bootstrap 60 / 검색 30 / LLM 20 / 업로드 20 / 찜 60 / 공개(u·timeline·discover) 60. 모든 응답에 보안 헤더(nosniff·X-Frame-Options·CSP 등).

## 폴더 구조
```
backend/
├── app/
│   ├── main.py         # 앱·CORS·보안헤더·rate limit 핸들러·라우터 등록
│   ├── config.py       # 환경변수 설정(pydantic-settings)
│   ├── deps.py         # Supabase JWT 인증 가드(JWKS/ES256)
│   ├── db.py           # Supabase PostgREST 접근(httpx) — 읽기/쓰기/소유권 스코프
│   ├── http.py         # 공유 httpx 클라이언트(lifespan 정리)
│   ├── storage.py      # 이미지 업로드(매직바이트 검증 + Storage)
│   ├── limiter.py      # slowapi rate limit(per-IP) 정의
│   ├── schemas.py      # Pydantic 계약(프론트 타입과 1:1, camelCase)
│   ├── llm/            # LLM provider 추상화(base·anthropic_provider·ratelimit)
│   └── routers/        # bootstrap·profile·folders·contents·youtube·llm·uploads·
│                       #   saves·public·timeline·discover·me(profile)·health
├── tests/              # pytest(모킹, 네트워크 없음) + conftest
├── requirements.txt
├── .env.example
└── .gitignore
```

## 개발 팁
- 프론트 연동을 **토큰 없이 먼저** 붙여보려면 `.env`에 `AUTH_OPTIONAL=true`(로컬 전용). 단 마이그레이션 후 **DB 쓰기는 실토큰 필요**(읽기·검색·LLM은 통과).
- 프론트 오리진이 바뀌면 `FRONTEND_ORIGINS`에 추가해야 CORS 통과.
- 유저 식별은 토큰(`sub`)으로 — 🔒 엔드포인트에 user_id를 넣지 않는다(사칭 방지).

## 진행 현황 / 후속
- **완료(dev 머지)**: CRUD 이관(M1)·소유권 RLS(M2)·이미지 Storage(M4)·rate limit·보안헤더(M5)·LLM(M6)·멀티유저·찜(M7)·타임라인·유사추천(M8) + `/api/me`.
- **후속 계획**: `docs/백엔드_작업계획.md §7`(배포 M9·데이터 무결성 M3·멀티유저 활성화 등).
- 프론트가 이어받을 연동 작업: `docs/프론트엔드_협업_가이드.md`(🤝 조율 항목 표).
