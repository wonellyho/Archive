# 메이도브 (Made of) — 프론트엔드

좋아하는 YouTube 음악·영상을 폴더별로 큐레이션하고, 영상은 TV, 음악은 회전하는
바이닐 인터페이스로 전시하는 개인 취향 아카이빙 서비스.

## 기술 스택

React 19 · TypeScript · Vite · React Router · Tailwind CSS v4 · oxlint ·
Supabase(데이터·인증) · Vercel(배포)

> 이 프로젝트는 **Node 프로젝트**라 `requirements.txt`가 없다. 의존성은
> `package.json` + `pnpm-lock.yaml`에 있으며 `pnpm install`로 한 번에 설치된다.

## 준비물 (Prerequisites)

- **Node.js 20.19+ 또는 22.12+** (`node -v`로 확인)
- **pnpm** — 없으면 아래 중 하나로 설치:
  ```bash
  corepack enable        # Node에 기본 포함. 권장.
  # 또는
  npm install -g pnpm
  ```

## 처음 실행 (Getting started)

```bash
# 1. 클론
git clone https://github.com/wonellyho/Archive.git
cd Archive/dumpout        # 앱 코드는 dumpout 폴더 안에 있음

# 2. 의존성 설치
pnpm install

# 3. 환경변수 파일 만들기
cp .env.example .env
#   .env 를 열고 값 3개 채우기 (아래 표 참고)

# 4. 개발 서버 실행
pnpm dev                  # http://localhost:5173
```

> `.env` 값(YouTube 키, Supabase URL/anon 키)은 깃에 올라가지 않으므로
> **팀 오너에게 비공개로 받아** 채운다.

## 환경변수 (`.env`)

| 변수 | 설명 |
|------|------|
| `VITE_YOUTUBE_API_KEY` | YouTube Data API v3 키 (검색용) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon(공개) 키 |

> **셋 다 비워두면** 앱은 자동으로 **localStorage 모드**(내 브라우저에만 저장,
> 편집 항상 가능)로 동작한다. Supabase 없이도 UI 개발은 바로 가능하다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 타입체크(`tsc -b`) + 프로덕션 빌드 |
| `pnpm lint` | oxlint 검사 |
| `pnpm preview` | 빌드 결과 미리보기 |

> 커밋 전 `pnpm lint`와 `pnpm build`가 통과하는지 확인할 것.

## 코드 구조 (요약)

```
src/
├── components/   # 화면 컴포넌트 (television · vinyl · folders · youtube · profile · auth · common)
├── context/      # 전역 상태 (TasteDataProvider · AuthProvider)
├── hooks/        # useYouTubePlayer · useYouTubeSearch
├── services/     # supabaseClient · supabaseRepository · repository · youtubeService · storageService
├── pages/        # PublicProfilePage · AdminPage
├── types/        # content · folder · profile · youtube 타입
└── router/       # AppRouter
```

## 백엔드(Supabase) 현황

- 현재 구조·테이블·RLS·인증 설명 → [`docs/supabase-status.md`](docs/supabase-status.md)
- DB 스키마 생성 SQL·설정 절차 → [`docs/supabase-setup.md`](docs/supabase-setup.md)

## 배포

`main` 브랜치에 push하면 Vercel이 자동 배포한다. 환경변수 3개는 Vercel
**Settings → Environment Variables** 에 등록되어 있어야 한다.
