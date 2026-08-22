# CLAUDE.md

메이도브(Made of) — 개인 취향 아카이빙 서비스. 좋아하는 YouTube 음악·영상을 폴더로
큐레이션해 영상은 TV, 음악은 회전 바이닐, 이미지·글은 핀보드로 전시한다.

이 파일은 **작업 규칙**만 담는다. 설치·실행 절차는 `README.md`(프론트) /
`backend/README.md`(백엔드)에 있으니 중복 작성하지 말고 그쪽을 갱신할 것.

## 리포 구조

한 리포에 두 앱이 산다.

| 경로 | 내용 |
|---|---|
| `src/` | 프론트엔드 (React 19 · TS · Vite · Tailwind v4 · React Router) — 리포 루트가 프론트 |
| `backend/` | FastAPI (Python 3.12) — Supabase JWT 검증, PostgREST 접근, LLM·업로드 프록시 |
| `docs/` | Supabase 스키마·설정 문서 |

프론트는 `pnpm`, 백엔드는 `pip` + venv. **루트에 `requirements.txt`가 없는 건 정상**이다.

## 명령어

```bash
# 프론트 (루트)
pnpm dev          # http://localhost:5173
pnpm lint         # oxlint
pnpm build        # tsc -b + vite build (타입체크 포함)

# 백엔드 (backend/, venv 활성화 후)
uvicorn app.main:app --reload --port 8001    # /docs 에 Swagger
python -m pytest -q                          # 네트워크 없이 모킹, 항상 전부 통과해야 함
```

**완료 기준**: 프론트 변경 → `pnpm lint` + `pnpm build` 통과. 백엔드 변경 →
`python -m pytest -q` 전부 통과. 통과 못 한 상태로 "완료"라고 보고하지 말 것.

## 데이터 소스 3-모드 (가장 자주 헷갈리는 부분)

`getRepository()` (`src/services/repository.ts:149`)가 환경변수로 저장소를 고른다.

| 조건 | 사용 저장소 |
|---|---|
| `VITE_API_URL` + Supabase 설정 둘 다 있음 | `apiRepository` — 읽기·쓰기 전부 FastAPI 경유 |
| Supabase만 설정됨 | `supabaseRepository` — Supabase 직행 |
| 둘 다 비어 있음 | `localRepository` — localStorage |

- 세 구현 모두 `TasteRepository` 인터페이스를 만족해야 한다. **저장소 메서드를 추가하면
  세 곳 전부 구현할 것** — 하나라도 빠지면 특정 모드에서만 조용히 깨진다.
- `VITE_API_URL`을 지우는 것이 백엔드 롤백 스위치다.
- 컴포넌트에서 `fetch`를 직접 부르지 말고 `src/services/apiClient.ts`의 `api()` /
  `uploadImage()` 헬퍼를 쓴다 (Bearer 토큰 자동 첨부).

## 백엔드 규칙

- **응답은 camelCase.** `app/schemas.py`의 Pydantic 계약이 `src/types/*.ts`와 1:1이다.
  한쪽을 바꾸면 반대쪽도 같이 바꾼다.
- **🔒 엔드포인트에 `user_id`를 입력으로 받지 않는다.** 사용자 식별은 항상 JWT의 `sub`.
  (사칭 방지) 소유권 스코프는 `app/db.py`에서 처리.
- 새 라우터는 `app/routers/`에 만들고 `app/main.py`에 등록 + `app/limiter.py`로 per-IP
  rate limit을 건다.
- 테스트는 네트워크를 타지 않는다. 외부 호출은 `tests/_http_fakes.py` 패턴으로 모킹.
- 테스트 함수명은 영어, docstring·주석은 한국어 (기존 컨벤션).

## 커밋 · 브랜치

```
브랜치: (front)feat/#70-pinboard   (back)feat/#59-account-delete
커밋:   [#70] feat: pinboard 편집 ui 정리
```

- 이슈 번호 필수. 접두어로 `(front)` / `(back)` 구분.
- 커밋 메시지 본문은 한국어. 타입은 `feat` / `fix` / `refactor` / `test` / `docs` / `chore`.
- `main` 직접 커밋 금지 — PR로 머지한다. `main` push 시 Vercel 자동 배포.

## 환경변수 함정 (실제로 시간을 크게 잡아먹었던 것들)

- **`.env` 바꾼 뒤 `--reload`는 소용없다.** 백엔드 `get_settings()`는 캐시되고 `.env`는
  프로세스 시작 시 한 번만 읽는다. uvicorn을 **완전히 죽였다가 새로 띄울 것.**
  Win11에는 `wmic`이 없고 `netstat -ano`가 유령 PID를 보여준다 → PowerShell의
  `Get-Process python` / `Stop-Process`로 실제 프로세스를 잡는다. 그다음 :8001에
  uvicorn 하나만 띄운다.
- **`SUPABASE_SERVICE_ROLE_KEY`는 모든 백엔드 쓰기에 필요**(폴더·콘텐츠·프로필·찜·업로드).
  없거나 비면 503. 반드시 **service_role secret 키**여야 한다 — anon/publishable 키를
  넣으면 Storage RLS 403이 502로 올라온다.
- 프론트도 `.env` 변경 후 vite dev 서버 재시작 필요.
- 백엔드 포트는 **8001** (8000은 로컬 충돌 회피). CORS 허용 오리진은
  `FRONTEND_ORIGINS`에 없으면 막힌다.
- `AUTH_OPTIONAL=true`는 로컬 전용이며 **읽기·검색·LLM만** 열린다. 쓰기 테스트는 실토큰 필요.

## 문서 지도

| 문서 | 단일 출처인 것 |
|---|---|
| `docs/PRD.md` | 제품 스코프와 **기능별 구현 상태**(✅🚧🔌⬜🚫) |
| `CLAUDE.md` (이 파일) | 개발 규칙·컨벤션·환경 함정 |
| `backend/app/schemas.py` + `/docs`(Swagger) | API 계약 |
| `README.md` / `backend/README.md` | 설치·실행 절차 |

- **기능을 완료하거나 착수하면 `docs/PRD.md`의 상태 표기를 함께 갱신할 것.**
- PRD의 🔌 표시(백엔드 구현 완료·UI 미노출) 항목은 **미사용처럼 보여도 지우지 않는다.**
- `backend/README.md`가 참조하는 `docs/API_명세.md`, `docs/백엔드_작업계획.md`,
  `docs/프론트엔드_협업_가이드.md`는 현재 리포에 **없다**. `docs/백엔드.md`도 비어 있다.
