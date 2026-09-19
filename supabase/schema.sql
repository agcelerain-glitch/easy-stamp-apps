-- =====================================================
-- スタンプラリーアプリ データベーススキーマ
-- Supabase SQL エディタで実行してください
-- =====================================================

-- =====================================================
-- テーブル作成
-- =====================================================

-- ユーザープロフィール（ニックネーム管理）
create table if not exists profiles (
  id          uuid primary key default gen_random_uuid(),
  nickname    text unique not null check (char_length(nickname) between 1 and 20),
  created_at  timestamptz not null default now()
);

-- スタンプ記録
create table if not exists stamps (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  stamp_point_id  int  not null check (stamp_point_id between 1 and 5),
  stamped_at      timestamptz not null default now(),
  unique (profile_id, stamp_point_id)
);

-- OTP コード（期限付き、スキャン後に削除）
create table if not exists otp_codes (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  stamp_point_id  int  not null check (stamp_point_id between 1 and 5),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

-- =====================================================
-- インデックス
-- =====================================================

create index if not exists otp_codes_expires_at_idx
  on otp_codes (expires_at);

create index if not exists otp_codes_profile_point_idx
  on otp_codes (profile_id, stamp_point_id);

create index if not exists stamps_profile_id_idx
  on stamps (profile_id);

-- =====================================================
-- Row Level Security
-- =====================================================

alter table profiles   enable row level security;
alter table stamps     enable row level security;
alter table otp_codes  enable row level security;

-- profiles: 全員が参照可能（ニックネーム存在確認に必要）
-- 書き込みは service_role（API Route 経由）のみ
create policy "profiles_select" on profiles
  for select using (true);

-- stamps: 全員が参照可能（スタンプ状況の表示に必要）
create policy "stamps_select" on stamps
  for select using (true);

-- otp_codes: 全員が参照可能
create policy "otp_codes_select" on otp_codes
  for select using (true);

-- =====================================================
-- Supabase Realtime 有効化
-- stamps テーブルへの INSERT をリアルタイムで配信する
-- =====================================================

alter publication supabase_realtime add table stamps;

-- =====================================================
-- 期限切れ OTP 自動削除（pg_cron）
-- Supabase ダッシュボード > Database > Extensions で
-- pg_cron を有効にしてから実行してください
-- =====================================================

-- select cron.schedule(
--   'delete-expired-otp',
--   '*/10 * * * *',   -- 10分おきに実行
--   $$
--     delete from otp_codes where expires_at < now();
--   $$
-- );
