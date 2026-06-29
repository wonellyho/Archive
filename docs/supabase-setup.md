# Supabase 설정 가이드

이 앱은 Supabase가 설정되면 데이터를 중앙 DB에 저장하고, 설정이 없으면
localStorage(개인 브라우저)로 동작합니다.

## 1. 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성.
2. 좌측 **SQL Editor** → 아래 SQL을 붙여넣고 실행.

```sql
-- 프로필 (단일 행)
create table if not exists profiles (
  id text primary key,
  name text not null default '',
  tagline text not null default '',
  bio text not null default '',
  keywords text[] not null default '{}',
  profile_image_url text
);

create table if not exists folders (
  id uuid primary key,
  type text not null check (type in ('music', 'video')),
  name text not null,
  cover_image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

-- Row Level Security: 누구나 읽기 / 로그인한 사용자만 쓰기
alter table profiles enable row level security;
alter table folders enable row level security;
alter table contents enable row level security;

create policy "public read profiles" on profiles for select using (true);
create policy "public read folders" on folders for select using (true);
create policy "public read contents" on contents for select using (true);

create policy "owner write profiles" on profiles for all to authenticated using (true) with check (true);
create policy "owner write folders" on folders for all to authenticated using (true) with check (true);
create policy "owner write contents" on contents for all to authenticated using (true) with check (true);
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

> anon 키는 클라이언트에 노출돼도 안전합니다. 위 RLS 정책이 쓰기를 막아주기
> 때문에, 로그인하지 않은 방문자는 읽기만 가능합니다.

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
