# Archive Backend (FastAPI)

개인 취향 아카이빙 서비스 **Archive**의 백엔드. 프론트엔드(React)에 내장돼 있던
외부 API 호출·데이터 접근 로직을 독립 백엔드로 이관하기 위한 서버다.

- 프레임워크: FastAPI (Python)
- 인증: Supabase JWT 검증
- DB / 인증 / 스토리지: Supabase (교체 아님, 유지)
- 배포(예정): Railway / Render

## 요구 사항
- Python 3.12+

## 초기 실행

```bash
cd backend

# 1) 가상환경
python -m venv .venv
#  Windows PowerShell:   .venv\Scripts\Activate.ps1
#  Windows Git Bash:     source .venv/Scripts/activate
#  macOS / Linux:        source .venv/bin/activate

# 2) 의존성 설치
pip install -r requirements.txt

# 3) 환경변수 준비 (값 채우기)
cp .env.example .env       # Windows: copy .env.example .env

# 4) 실행
uvicorn app.main:app --reload --port 8001
```

- 헬스체크: <http://localhost:8001/health>
- API 문서(Swagger): <http://localhost:8001/docs>

## 현재 엔드포인트
| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| GET | `/health` | 서버 상태 확인 | 불필요 |
| GET | `/api/youtube/search?q=&type=` | YouTube 검색 프록시(키 은닉) | 필요 |

## 폴더 구조
```
backend/
├── app/
│   ├── main.py         # 앱·CORS·라우터 등록
│   ├── config.py       # 환경변수 설정
│   ├── deps.py         # Supabase JWT 인증 가드
│   ├── schemas.py      # Pydantic 데이터 계약(프론트 타입과 1:1, camelCase)
│   └── routers/
│       ├── health.py
│       └── youtube.py  # 검색 프록시
├── requirements.txt
├── .env.example
└── .gitignore
```

## 개발 팁
- 프론트 연동을 **토큰 없이 먼저** 붙여보려면 `.env`에 `AUTH_OPTIONAL=true` (로컬 전용, 배포 금지).
- 프론트 오리진이 바뀌면 `FRONTEND_ORIGINS`에 추가해야 CORS가 통과된다.

## 후속 이슈 (예정)
- 프로필 / 폴더 / 콘텐츠 CRUD 이관 (`apiRepository`)
- RLS 재설계 (`auth.uid() = user_id`)
- 이미지 → Supabase Storage
- LLM 문구 추천 · 감성 분석 (인젝션 방어)
- 멀티유저 (`user_id`, `/u/:username`, 찜)
