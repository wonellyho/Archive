# Supabase 설정 가이드

이 앱은 Supabase가 설정되면 데이터를 중앙 DB에 저장하고, 설정이 없으면
localStorage(개인 브라우저)로 동작합니다.

## 1. 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성.
2. 좌측 **SQL Editor** → 아래 SQL을 붙여넣고 실행.

> 현재 스키마 = **M2(user_id 소유권) 반영**(2026-07-05). 각 행에 소유자(`user_id`)가 있고, 로그인 사용자는 **자기 소유 데이터만** 쓸 수 있습니다.

```sql
-- 프로필 (사이트 단일 프로필: id='me')
-- 컬럼 순서는 실제 DB와 동일(user_id는 M2에서 add column 되어 맨 끝).
create table if not exists profiles (
  id text primary key default gen_random_uuid()::text,  -- 유저별 프로필: 신규는 자동 생성
  name text not null default '',
  tagline text not null default '',
  bio text not null default '',
  keywords text[] not null default '{}',
  profile_image_url text,
  user_id uuid not null references auth.users (id),
  username text                                          -- 공개 페이지 /u/{username} (선택)
);

create table if not exists folders (
  id uuid primary key,
  type text not null check (type in ('music', 'video')),
  name text not null,
  cover_image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id)
);

create table if not exists contents (
  id uuid primary key,
  type text not null check (type in ('music', 'video')),
  folder_id uuid references folders (id) on delete cascade,
  youtube_video_id text not null,
  source_title text not null default '',
  source_channel text not null default '',
  thumbnail_url text not null default '',
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id)
);

create index if not exists idx_folders_user_id  on folders (user_id);
create index if not exists idx_contents_user_id on contents (user_id);

-- 프로필: 1인 1행 + username 유일(대소문자 무시, 값 있을 때만)
create unique index if not exists uq_profiles_user_id  on profiles (user_id);
create unique index if not exists uq_profiles_username on profiles (lower(username));

-- Row Level Security: 누구나 읽기 / 본인 소유 데이터만 쓰기
alter table profiles enable row level security;
alter table folders enable row level security;
alter table contents enable row level security;

create policy "public read profiles" on profiles for select using (true);
create policy "public read folders" on folders for select using (true);
create policy "public read contents" on contents for select using (true);

-- 소유권 기반 쓰기: 로그인 사용자가 auth.uid() = user_id 인 행만 (insert/update/delete)
create policy "owner insert profiles" on profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update profiles" on profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete profiles" on profiles for delete to authenticated using (auth.uid() = user_id);
create policy "owner insert folders" on folders for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update folders" on folders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete folders" on folders for delete to authenticated using (auth.uid() = user_id);
create policy "owner insert contents" on contents for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update contents" on contents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete contents" on contents for delete to authenticated using (auth.uid() = user_id);
```

> 백엔드(FastAPI)는 service_role 키로 쓰기하며 RLS를 우회하므로, **소유권은 백엔드가 직접 재확인**합니다(생성 시 `user_id` 스탬프, 수정/삭제 시 `user_id` 스코프). 위 RLS는 직접 DB 접근에 대한 2차 방어입니다.

## 1-1. 이미지 Storage 버킷 (M4)

커버·프로필 이미지는 base64 대신 Supabase Storage 공개 버킷에 저장합니다.

1. 대시보드 → **Storage** → **New bucket**
2. 이름 **`images`**, **Public bucket** 켜기(공개 읽기) → Create
3. 업로드는 백엔드가 service_role로 대신 수행하므로 별도 쓰기 정책 불필요. 이미지는 공개 URL로 서빙됩니다.

> 버킷 이름을 바꾸려면 `backend/.env`의 `STORAGE_BUCKET`도 함께 바꾸세요(기본 `images`). 업로드 크기 상한은 `MAX_UPLOAD_BYTES`(기본 2MB).

## 1-2. 찜(saves) 테이블 (M7-A)

로그인 사용자가 콘텐츠를 찜(북마크)합니다. **본인 찜만** 읽고/쓰기 가능.

```sql
create table if not exists saves (
  user_id uuid not null references auth.users (id),
  content_id uuid not null references contents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
create index if not exists idx_saves_user_id on saves (user_id);

alter table saves enable row level security;
create policy "own read saves"   on saves for select to authenticated using (auth.uid() = user_id);
create policy "own insert saves" on saves for insert to authenticated with check (auth.uid() = user_id);
create policy "own delete saves" on saves for delete to authenticated using (auth.uid() = user_id);
```

## 2. 본인(관리자) 계정 만들기

1. **Authentication → Providers → Email** 활성화.
2. **Authentication → Users → Add user** 로 본인 이메일/비밀번호 생성하고
   "Auto Confirm User"를 켜 두세요. (이 계정으로만 편집이 가능합니다.)

## 3. 키 넣기

**Project Settings → API** 에서 값을 복사해 `.env`에 입력:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> anon 키는 클라이언트에 노출돼도 안전합니다. 위 RLS 정책상 방문자는 읽기만,
> 로그인 사용자도 **본인 소유(user_id) 데이터만** 쓸 수 있습니다.

개발 서버를 재시작하면 적용됩니다. 우측 상단 **🔒 관리자**로 로그인하면 편집
모드가 켜집니다.

## 4. 배포 (Vercel)

Vercel 프로젝트 **Settings → Environment Variables** 에 동일하게 입력:

- `VITE_YOUTUBE_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

배포하면 누구나 URL에서 당신의 데이터를 볼 수 있고, 당신만 로그인해서 편집할 수
있습니다.

## 참고

- 지금까지 localStorage에 입력한 데이터는 Supabase로 자동 이전되지 않습니다.
  Supabase 설정 후에는 콘텐츠를 다시 등록하면 됩니다.
- 폴더 커버 이미지는 480px JPEG data URL로 DB에 함께 저장됩니다.
