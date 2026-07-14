-- ============================================================
-- Meenakshi — Notification & AI Briefing Engine
-- Migration 001: Core tables
-- ============================================================

-- Generated briefings, cached so the app doesn't regenerate on every open
create table if not exists ai_briefings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  briefing_type text not null check (briefing_type in ('daily', 'weekly')),
  content jsonb not null, -- { headline, sections: [{title, items: [...]}] }
  generated_at timestamptz default now(),
  read_at timestamptz
);

alter table ai_briefings enable row level security;

create policy "Users see own briefings"
  on ai_briefings for all using (auth.uid() = user_id);

create index if not exists ai_briefings_user_type_idx
  on ai_briefings (user_id, briefing_type, generated_at desc);

-- ────────────────────────────────────────────────────────────

-- Individual notifications with DB-enforced dedup + priority
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('financial_alert','relationship_reminder','renewal','opportunity')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  title text not null,
  body text not null,
  source_event_id uuid,
  dedup_key text not null,
  created_at timestamptz default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

-- Unique index enforces deduplication at DB level
create unique index if not exists notifications_dedup_idx
  on notifications (user_id, dedup_key);

alter table notifications enable row level security;

create policy "Users see own notifications"
  on notifications for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────

-- Notification preferences per user
create table if not exists notification_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  daily_briefing boolean default true,
  financial_alerts boolean default true,
  relationship_reminders boolean default true,
  renewals boolean default true,
  opportunities boolean default true,
  push_token text
);

alter table notification_preferences enable row level security;

create policy "Users manage own preferences"
  on notification_preferences for all using (auth.uid() = user_id);
