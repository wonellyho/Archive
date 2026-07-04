# 메이도브 — Supabase 현황 (온보딩용)

> 처음 합류한 개발자가 "지금 백엔드가 어디까지 돼 있나"를 빠르게 파악하기 위한 문서.

## 한 줄 요약

현재는 **별도 백엔드 서버가 없다.** 브라우저(React SPA)가 Supabase를 **직접** 호출한다.
데이터는 **한 명의 오너(단일 사용자)** 기준으로 저장되며, 로그인한 오너만 편집하고
방문자는 읽기 전용이다. (멀티유저 아님)

## 접속 정보

| 항목 | 값 |
|------|------|
| Project ref | `sqgrvattuqotklfqbjwo` |
| Region | Northeast Asia (Seoul) `ap-northeast-2` |
| API URL | `https://sqgrvattuqotklfqbjwo.supabase.co` |
| 프론트 env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

- `anon` 키는 공개돼도 되는 키다. 실제 방어선은 아래 **RLS**.
- 대시보드에서 확인할 곳: **Table Editor**(데이터), **Authentication → Users**(로그인 계정), **SQL Editor**(스키마), **Settings → API Keys**(키).

## 테이블 (3개)

### `profiles` — 프로필 (행 1개만 사용, `id = 'me'`)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | text (PK) | 항상 `'me'` 고정 |
| `name` | text | 이름 |
| `tagline` | text | 한 줄 소개 |
| `bio` | text | 인사말 본문 |
| `keywords` | text[] | 취향 키워드 배열 |
| `profile_image_url` | text (nullable) | 프로필 이미지 |

### `folders` — 폴더
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK) | 프론트에서 생성 |
| `type` | text | `'music'` \| `'video'` |
| `name` | text | 폴더 이름 |
| `cover_image_url` | text (nullable) | **커버 이미지가 base64 data URL로 통째로 저장됨** (스토리지 버킷 미사용) |
| `sort_order` | int | 정렬 순서 |
| `created_at` | timestamptz | 생성 시각 |

### `contents` — 콘텐츠(음악/영상)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK) | 프론트에서 생성 |
| `type` | text | `'music'` \| `'video'` |
| `folder_id` | uuid (FK→folders, **ON DELETE CASCADE**) | 소속 폴더 |
| `youtube_video_id` | text | 유튜브 영상 ID (원본은 저장 안 함) |
| `source_title` | text | 유튜브 원본 제목(출처) |
| `source_channel` | text | 유튜브 채널명(출처) |
| `thumbnail_url` | text | 썸네일 |
| `title` | text | **사용자가 쓴** 제목 |
| `subtitle` | text | **사용자가 쓴** 부제목 |
| `body` | text | **사용자가 쓴** 감상/본문 |
| `sort_order` | int | 정렬 순서 |
| `created_at` | timestamptz | 생성 시각 |

> 설계 원칙: **유튜브 원본 메타데이터(`source_*`)와 사용자 해석(`title/subtitle/body`)을 분리 저장.**
> 원본 미디어는 저장·재배포하지 않고 `youtube_video_id` + 출처만 보관한다.

## 보안 (RLS) — 중요

세 테이블 모두 Row Level Security **ON**. 정책:

- **읽기(SELECT): 누구나** (익명 방문자 포함)
- **쓰기(INSERT/UPDATE/DELETE): 로그인한 사용자만** (`to authenticated`)

⚠️ **한계(반드시 인지):** 정책이 "로그인만 하면 전부 쓰기 허용"이라 **사용자별 데이터 격리가 없다.**
지금은 오너 1명 전제라 문제없지만, 멀티유저로 갈 땐 `user_id` 컬럼 + 사용자별 RLS로 재설계 필요.

## 인증 (Auth)

- 방식: **이메일 + 비밀번호** (Supabase Auth).
- 편집 권한: 앱은 **"로그인되어 있으면 오너"** 로 취급한다(사용자 구분 없음).
- 로그인 계정은 대시보드 **Authentication → Users → Add user** 로 생성(Auto Confirm 켜기).

## 프론트엔드 연동 방식 (코드 위치)

| 파일 | 역할 |
|------|------|
| `src/services/supabaseClient.ts` | env로 Supabase 클라이언트 생성. 없으면 localStorage 모드로 폴백 |
| `src/services/supabaseRepository.ts` | **실제 DB 읽기/쓰기(CRUD)** — 여기가 핵심 |
| `src/services/repository.ts` | Supabase / localStorage 중 자동 선택 (추상화 인터페이스) |
| `src/context/TasteDataProvider.tsx` | 앱 시작 시 3테이블 전부 로드 + 낙관적(optimistic) 저장 |
| `src/context/AuthProvider.tsx` | 세션 → `isOwner`. 모든 편집 UI가 이걸로 게이팅됨 |

- **로드:** 앱 시작 시 profiles/folders/contents를 한 번에 fetch.
- **저장:** 화면에 즉시 반영 후 백그라운드로 DB 반영(낙관적 업데이트). PK(uuid)는 프론트에서 생성.

## 구현된 것 / 아직 안 된 것

**✅ 되어 있음**
- 테이블 3개 + RLS(공개 읽기 / 로그인 쓰기)
- 이메일 로그인, 오너만 편집(추가·수정·삭제) UI 게이팅
- 프론트에서 프로필·폴더·콘텐츠 CRUD 전부 동작
- env 없으면 localStorage로 자동 폴백

**🚧 아직 (향후 과제)**
- **멀티유저**: `user_id` 컬럼 + 사용자별 RLS (현재 데이터는 전역 공유)
- **키 은닉용 백엔드(FastAPI 게이트웨이)**: 지금은 브라우저가 직접 호출, 키가 번들에 노출
- **Supabase Storage 버킷**: 커버 이미지가 지금은 DB에 data URL로 저장됨 → 용량↑
- 정렬 변경 UI, 마이그레이션/시드 스크립트 등

## 스키마를 직접 다시 만들려면

전체 생성 SQL(테이블 + RLS)은 **`docs/supabase-setup.md`** 에 있음. SQL Editor에 붙여넣고 Run.
