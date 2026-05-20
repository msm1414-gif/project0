-- 日記Bot DB スキーマ（設計書セクション8）。
-- Supabase の SQL Editor に貼り付けて実行する。
-- カレンダー予定はこのDBに持たない（project0 の Vercel KV から都度取得する）。

-- ユーザー（当面は作者本人のみ）
create table if not exists diary_users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  registered_at timestamptz not null default now(),
  delivery_hour int not null default 22,          -- 夜の口火を切る時刻 (JST)
  bot_persona text not null default 'default',     -- Bot口調設定
  calendar_share_token text                        -- project0 カレンダーの共有トークン
);

-- 生メッセージログ（言い回し生成と継続性の燃料）
create table if not exists diary_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references diary_users(id) on delete cascade,
  sender text not null check (sender in ('user', 'bot')),
  body text not null,
  context text not null check (context in ('daytime', 'session')),
  created_at timestamptz not null default now()
);
create index if not exists idx_diary_messages_user_created
  on diary_messages (user_id, created_at desc);

-- 日付ごとの生ログ＋スロット充足状態
create table if not exists diary_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references diary_users(id) on delete cascade,
  log_date date not null,
  slots jsonb not null default '{}'::jsonb,        -- Partial<Record<SlotId, SlotFill>>
  asked_rotation text[] not null default '{}',     -- その夜に聞いたローテーションスロット
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- 日付ごとの清書日記（週次バッチで生成）
create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references diary_users(id) on delete cascade,
  entry_date date not null,
  body text not null,
  emotions text[] not null default '{}',
  condition int check (condition between 1 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- 週次まとめ（次週プランニングの入力）
create table if not exists diary_weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references diary_users(id) on delete cascade,
  week_start date not null,                        -- その週の月曜
  body text not null,
  gratitude_list text[] not null default '{}',
  goal_progress text not null default '',
  emotion_trend jsonb not null default '{}'::jsonb,-- Record<EmotionLabel, number>
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- 週次質問プラン（日付×重点テーマ×予定アンカー）
create table if not exists diary_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references diary_users(id) on delete cascade,
  week_start date not null,
  days jsonb not null default '[]'::jsonb,         -- PlanDay[]
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
