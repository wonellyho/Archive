# Maydove PRD

> 최종 갱신: 2026-08-22 · 현재 브랜치 기준 실제 구현 상태를 반영함.
> 구현 상태 표기는 코드와 함께 갱신할 것. 문서가 코드보다 앞서거나 뒤처지면
> 스코프 판단이 틀어진다.

---

## 1. Product Summary

**Maydove**는 사용자가 좋아하는 YouTube 음악·영상을 한 공간에 모아 전시하고,
자신의 취향을 콘텐츠를 통해 자연스럽게 보여주는 개인 취향 아카이빙 서비스다.

> **취향을 설명하는 대신, 좋아했던 콘텐츠로 자신을 보여준다.**

### ⚠️ 명칭 통일 필요 (결정 대기)

현재 리포에 서비스명이 5개로 흩어져 있다. 하나로 정하고 전부 맞춰야 한다.

| 위치 | 현재 표기 |
|---|---|
| 본 PRD | Maydove |
| `README.md` | 메이도브 (Made of) |
| `backend/README.md` | Archive |
| `index.html` `<title>` | **NOAH — a taste archive** ← 공유 링크 열면 탭에 뜨는 이름 |
| 리포 · 폴더명 | dumpout |

공유가 핵심 플로우인 제품에서 **방문자가 보는 첫 문자열**이 통일돼 있지 않은 건
그 자체로 제품 결함이다. 정식 표기(한글/영문)를 확정해 이 절에 박아둔다.

---

## 2. Problem

현재 사용자의 음악·영상 취향은 YouTube 재생목록, SNS, 메신저 등에 흩어져 있다.
기존 SNS에서는 자신의 취향을 보여주기 위해 별도의 게시물이나 스토리를 만들어야 해,
실제 취향을 기록하기보다 의도적으로 연출하는 느낌이 생길 수 있다.

또한 YouTube 콘텐츠 공유는
**YouTube → 공유 → 메신저 선택 → 링크 전달 → YouTube 이동**
과정이 필요해 플랫폼 내부 공유보다 접근 단계가 많다.

### 핵심 문제

- 좋아하는 콘텐츠를 지속적으로 모아 보여줄 공간 부족
- 취향을 직접 설명하거나 연출해야 하는 부담
- 콘텐츠 공유 과정의 높은 Depth
- 콘텐츠 취향을 기반으로 다른 사람을 탐색하기 어려움

---

## 3. Goal

### MVP Goal

사용자가 좋아하는 YouTube 음악·영상을 저장·정리·전시하고,
하나의 링크로 자신의 취향 공간을 공유할 수 있도록 한다.

### Long-term Vision

콘텐츠 취향을 기반으로 사람을 발견하고 연결하는 소셜 플랫폼으로 확장한다.

---

## 4. Target User

YouTube·YouTube Music을 자주 이용하며 음악과 영상을 저장하거나 친구에게 공유하는
10~20대 사용자. 특히:

- 자신의 취향을 보여주는 데 관심이 있음
- SNS 게시물처럼 직접적으로 취향을 드러내는 것은 부담스러움
- 좋아했던 콘텐츠를 한곳에 기록하고 싶음

---

## 5. Core User Flow

**발견 → 저장 → 정리 → 전시 → 공유 → 탐색**

1. YouTube 콘텐츠 검색 또는 등록
2. 음악·영상 저장
3. 폴더 및 공간에 배치
4. 감상·메모 작성
5. 개인 Maydove 링크(`/u/{username}`) 공유
6. 방문자가 콘텐츠 탐색 및 재생

### 방문자 모델 (현재 확정된 범위)

- `/u/{username}`은 **로그인 없이 열람 가능**하며 **읽기 전용으로 강제**된다.
  자기 계정으로 로그인한 상태로 자기 공유 링크를 열어도 편집할 수 없다
  (편집은 오직 `/`에서만). — `AuthProvider`의 `forceReadOnly`
- 방문자가 남의 콘텐츠를 **찜**하거나 **취향이 비슷한 사용자를 탐색**하는 동선은
  백엔드가 준비돼 있으나 아직 UI가 없다. → §8 참조

---

## 6. Platform

**Responsive Web** — 공유받은 사용자가 앱 설치 없이 바로 접근할 수 있도록 웹을 우선한다.
향후 필요 시 PWA 및 Native App으로 확장한다.

### ⚠️ 모바일 전략 (결정 대기)

원안은 "Mobile-first"였으나 **현재 구현은 Mobile-first가 아니다.**

- 반응형 접두어(`sm:`/`md:`/`lg:`/`xl:`) 사용이 `src/**/*.tsx` 전체에서 44곳.
  컴포넌트 약 50개 규모 대비 얇다.
- 더 근본적으로 회전 바이닐 · TV · 3D 선반 · 핀보드는 **넓은 화면을 전제한 공간형
  데스크톱 은유**라 좁은 세로 화면으로 자연스럽게 접히지 않는다.

공유 링크는 대부분 모바일에서 열리므로 이 간극은 제품 핵심 가치에 직접 영향을 준다.
아래 중 하나를 골라 이 절을 확정해야 한다.

- **(A) Mobile-first 유지** → 모바일 레이아웃 작업을 MVP 필수 항목으로 §7에 추가
- **(B) 전략 수정** → "데스크톱 편집·전시 + 모바일 열람 최적화"로 문서를 현실에 맞춤

---

## 7. MVP Scope — 구현 완료 ✅

이미 동작하는 기능. PRD의 MVP는 아래를 포함한다.

### 계정 · 프로필

| 기능 | 비고 |
|---|---|
| 로그인 / 로그아웃 | Supabase Auth (email + password) |
| 사용자 프로필 (이름·소개·키워드) | `ProfileEditModal`, `TasteKeywords` |
| 고유 username 및 공개 URL `/u/{username}` | 중복 409 / 형식 422 처리됨 |
| 프로필 이미지 업로드 | `ProfileSettingsModal` → `POST /api/uploads` |
| 공유 모달 | `ShareProfileModal` |

### 콘텐츠 수집 · 정리

| 기능 | 비고 |
|---|---|
| YouTube 검색 및 콘텐츠 등록 | 백엔드 모드에서는 `/api/youtube/search` 프록시 경유 |
| 음악 · 영상 저장 (`music` / `video`) | |
| 폴더 CRUD 및 분류 | 소유권 스코프 적용 |
| 폴더 커버 이미지 업로드 | `FolderFormModal` → `POST /api/uploads` |
| 콘텐츠별 감상·메모 | `TasteContent`의 `title` / `subtitle` / `body` |

### 전시 · 재생

| 기능 | 비고 |
|---|---|
| Vinyl (음악) 전시 · 회전 인터랙션 | `VinylPlayer`, `VinylRecord` |
| Television (영상) 전시 | `Television`, `FloatingVideo` |
| 3D 폴더 선반 | `FolderShelf` |
| **Pinboard (이미지·글 전시)** | 🚧 마무리 단계 — 아래 참고 |
| YouTube Embed 재생 | `useYouTubePlayer` |
| 백그라운드 재생 · 미니 플레이어 | `MiniPlayer`, `PlaybackDock` |
| 배경화면 커스터마이징 | `BackgroundProvider`, `BackgroundPicker` |
| 취향 타임라인 "축적" 뷰 | `TasteTimeline` + `GET /api/timeline/{username}` |

> **Pinboard 상태 (2026-08-22)**: 프론트(`Pinboard`·`PinDetail`·`RichTextEditor`·
> `ImageCropper`)와 저장소 연동(`apiRepository`의 pin CRUD)은 있고, 백엔드
> `backend/app/routers/pins.py`는 **아직 커밋되지 않은 작업 중** 상태다.
> 커밋·테스트 추가 후 ✅로 승격할 것.

### 시스템 · 운영

| 기능 | 비고 |
|---|---|
| 계정 탈퇴 API | `DELETE /api/me` — **프론트 UI 없음** (§9) |
| 3-모드 데이터 소스 전환 | API / Supabase 직행 / localStorage — `CLAUDE.md` 참조 |
| per-IP rate limit · 보안 헤더 | `app/limiter.py`, `main.py` |
| 사용자별 데이터 접근 권한 분리 | JWT `sub` 기반 소유권 스코프 |

---

## 8. 구현 완료 · UI 미노출 🔌

**백엔드는 만들어져 있고 테스트도 통과하지만 프론트에서 호출하지 않는 기능.**
지우면 안 된다. UI만 붙이면 살아난다.

| 엔드포인트 | 기능 | 붙일 화면 (예상) |
|---|---|---|
| `GET·POST·DELETE /api/saves` | 찜 (본인만·멱등) | 방문자가 남의 콘텐츠를 저장 |
| `GET /api/discover/similar/{contentId}` | 유사 콘텐츠 추천 | 콘텐츠 상세 하단 |
| `GET /api/discover/users/{username}` | 취향 유사 사용자 탐색 | 프로필 / 탐색 탭 |
| `GET /api/u/{username}` | 공개 아카이브 조회 | `/u/:username` 페이지에서 활용 여지 |
| `POST /api/llm/suggest` | LLM 문구 추천 (콘텐츠별 캡션·무드) | 콘텐츠 작성 보조 |
| `/api/contents/{id}/highlights` (GET·POST·PATCH·DELETE) | 하이라이트 · 타임스탬프 코멘트 | 재생 화면 |
| `GET /api/search/users` | 사용자 검색 (부분 일치) | 탐색 진입점 |

> **주의**: 이 항목들은 원안 PRD에서 "Out of Scope(추천 알고리즘 / 사용자 매칭 /
> 좋아요)"로 분류돼 있었다. 실제로는 **이미 구현된 자산**이므로 별도 상태로 관리한다.

---

## 9. 구현 예정 ⬜

**만들 계획이 있으나 아직 착수하지 않은 것.** 우선순위 순.

### MVP 필수 (베타 전 반드시)

| 항목 | 현재 상태 | 이유 |
|---|---|---|
| **회원가입 UI** | `src/`에 `signUp` 호출 **0건**. `LoginModal`은 로그인 전용 | 가입 경로가 없으면 베타 사용자를 받을 수 없다 |
| **계정 탈퇴 UI** | 백엔드 `DELETE /api/me`만 존재 | 개인정보 처리 요건 |
| **지표 계측 도입** | analytics 도구 **미설치** (§11) | 지금 상태로는 성공 지표를 하나도 측정할 수 없다 |
| **모바일 레이아웃** | §6 결정에 따름 | 공유 링크의 주 진입 환경 |
| Pinboard 백엔드 커밋 · 테스트 | 작업 중 | §7 참조 |

### MVP 이후

- §8 미노출 기능들에 UI 붙이기 (찜 → 유사 사용자 탐색 순 권장)
- 콘텐츠 공개/비공개 설정
- PWA 전환
- 방문자 로그인 및 저장 모델 확장

---

## 10. Out of Scope 🚫

**의도적으로 만들지 않는 것.** (§8·§9와 혼동 금지 — 여긴 "안 만든다"가 확정된 항목만.)

- 팔로우 / DM / 댓글 / 좋아요 등 **본격 SNS 상호작용 레이어**
  - ※ 찜(`/api/saves`)은 "좋아요"가 아니라 **개인 보관** 용도이며 §8에 속한다.
- 자체 영상 · 음원 **업로드 및 호스팅** — YouTube를 대체하지 않는다
- 커머스
- Native App (PWA까지가 확장 상한)
- 메타버스 연동

---

## 11. Non-functional Requirements

| 항목 | 현재 충족 여부 |
|---|---|
| 사용자별 데이터 접근 권한 분리 | ✅ JWT `sub` 기반. 🔒 엔드포인트에 `user_id`를 받지 않음 |
| YouTube 원본 영상·음원 미저장 (Video ID·메타데이터만) | ✅ `TasteContent`가 `youtubeVideoId`만 보유 |
| 공식 YouTube API / Embed 활용 | ✅ |
| 초기 수백~수천 명 규모 대응 구조 | ✅ Supabase + FastAPI |
| **API Key 클라이언트 노출 방지** | ⚠️ **조건부** — 아래 참조 |
| Responsive UI | ⚠️ §6 결정 대기 |
| 주요 화면 로딩 목표 | ⚠️ 기준 미정 — 아래 참조 |

### ⚠️ API Key 노출

`VITE_YOUTUBE_API_KEY`는 **클라이언트 번들에 그대로 포함된다.**
이 요구사항은 `VITE_API_URL`을 설정해 백엔드 프록시(`/api/youtube/search`)를 태우는
**전체 API 모드에서만 충족**된다.

→ **베타 배포는 반드시 전체 API 모드로 한다.** Supabase 직행 모드는 로컬 개발 전용.

### ⚠️ 로딩 목표

"3초 이내"는 측정 조건이 없으면 검증 불가능하다. 다음 형태로 확정할 것:
> *어느 화면* / *어느 네트워크* / *어느 백분위수*
> 예: "`/u/{username}` 첫 화면, 4G, p75에서 3초 이내"

---

## 12. Success Metrics

MVP에서는 단순 가입자 수보다 **취향 공간 생성·공유·재방문 여부**를 중심으로 본다.

| Metric | Initial Target | 측정 방법 |
|---|---:|---|
| Beta Users | 50명 | Supabase 쿼리 ✅ |
| 콘텐츠 5개 이상 등록 | 60% 이상 | Supabase 쿼리 ✅ |
| 사용자당 평균 콘텐츠 | 10개 이상 | Supabase 쿼리 ✅ |
| 프로필 공유 사용자 | 30% 이상 | **계측 필요** ⬜ |
| D7 Retention | 25% 이상 | **계측 필요** ⬜ |

> **현재 리포에 analytics 도구가 하나도 설치돼 있지 않다** (gtag / amplitude /
> posthog / mixpanel 전부 0건). 아래 두 이벤트만 붙여도 5개 지표를 전부 채울 수 있다:
> `profile_shared`(공유 모달 실행/링크 복사), `session_start`(username 단위).

### 핵심 검증 질문

> **사용자는 자신이 좋아했던 콘텐츠를 한 공간에 모으고,
> 그 공간을 자신의 취향 프로필처럼 사용하고 싶어 하는가?**

---

## 13. Product Principle

기능 추가 시 다음 기준을 우선한다.

- 사람보다 **콘텐츠가 먼저** 보이는가
- 취향을 **억지로 표현하게** 만들지 않는가
- 취향이 **시간이 지나며 축적**되는가
- **공유받은 사람**이 쉽게 접근할 수 있는가
- 콘텐츠 플랫폼을 대체하지 않고 **취향 Layer** 역할을 하는가

> 세 번째 원칙("축적")은 이미 `TasteTimeline`(§7)으로 구현돼 있다.
> 원칙이 화면으로 존재하는 유일한 항목이므로 대표 기능으로 밀어볼 만하다.

---

## 부록 — 스코프 상태 표기 규칙

| 표기 | 의미 |
|---|---|
| ✅ | 구현 완료, 동작 중 |
| 🚧 | 작업 중 |
| 🔌 | 백엔드 구현 완료, UI 미노출 — **지우지 말 것** |
| ⬜ | 구현 예정, 미착수 |
| 🚫 | 명시적 제외 — 만들지 않기로 확정 |

기능을 추가·완료할 때 이 문서의 표기를 함께 갱신한다.
개발 규칙·환경 설정은 `CLAUDE.md`, API 계약은 `backend/app/schemas.py`와
Swagger(`/docs`)가 단일 출처다.
