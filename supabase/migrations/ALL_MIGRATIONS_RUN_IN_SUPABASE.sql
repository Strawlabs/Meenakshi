-- ============================================================
-- STEP 1: Run this in Supabase Dashboard → SQL Editor
-- Creates: ai_briefings, notifications, notification_preferences
-- Idempotent: safe to re-run if tables/policies already exist.
-- ============================================================

-- Generated briefings
create table if not exists ai_briefings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  briefing_type text not null check (briefing_type in ('daily', 'weekly')),
  content jsonb not null,
  generated_at timestamptz default now(),
  read_at timestamptz
);
alter table ai_briefings enable row level security;
-- Drop before recreate: Postgres has no "CREATE POLICY IF NOT EXISTS"
drop policy if exists "Users see own briefings" on ai_briefings;
create policy "Users see own briefings"
  on ai_briefings for all using (auth.uid() = user_id);
create index if not exists ai_briefings_user_type_idx
  on ai_briefings (user_id, briefing_type, generated_at desc);

-- Notifications with dedup
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
create unique index if not exists notifications_dedup_idx
  on notifications (user_id, dedup_key);
alter table notifications enable row level security;
drop policy if exists "Users see own notifications" on notifications;
create policy "Users see own notifications"
  on notifications for all using (auth.uid() = user_id);

-- Preferences
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
drop policy if exists "Users manage own preferences" on notification_preferences;
create policy "Users manage own preferences"
  on notification_preferences for all using (auth.uid() = user_id);

-- ============================================================
-- STEP 2: RPC for priority-ordered notifications
-- ============================================================

create or replace function get_unread_notifications(p_user_id uuid)
returns setof notifications
language sql stable security definer as $$
  select n.*
  from notifications n
  join notification_preferences np on np.user_id = p_user_id
  where n.user_id = p_user_id
    and n.read_at is null
    and n.dismissed_at is null
    and (
      (n.category = 'financial_alert'       and np.financial_alerts = true)
      or (n.category = 'relationship_reminder' and np.relationship_reminders = true)
      or (n.category = 'renewal'             and np.renewals = true)
      or (n.category = 'opportunity'         and np.opportunities = true)
    )
  order by
    case n.priority
      when 'high'   then 1
      when 'medium' then 2
      else               3
    end asc,
    n.created_at desc;
$$;

-- ============================================================
-- STEP 3: pg_cron schedules (run AFTER Edge Functions deployed)
-- Replace <SERVICE_ROLE_KEY> with your actual key from:
-- Supabase Dashboard → Settings → API → service_role
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Daily briefing: 7:00 AM IST = 01:30 UTC
-- Unschedule first so re-running this SQL is safe
select cron.unschedule('meenakshi-daily-briefing') where exists (
  select 1 from cron.job where jobname = 'meenakshi-daily-briefing'
);
select cron.schedule(
  'meenakshi-daily-briefing',
  '30 1 * * *',
  $$
    select net.http_post(
      url     := 'https://cwdcwapftsfvptlpquky.supabase.co/functions/v1/generate-daily-briefing',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Weekly digest: Sunday 6:00 PM IST = 12:30 UTC Sunday
select cron.unschedule('meenakshi-weekly-digest') where exists (
  select 1 from cron.job where jobname = 'meenakshi-weekly-digest'
);
select cron.schedule(
  'meenakshi-weekly-digest',
  '30 12 * * 0',
  $$
    select net.http_post(
      url     := 'https://cwdcwapftsfvptlpquky.supabase.co/functions/v1/generate-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verify
select jobid, jobname, schedule from cron.job where jobname like 'meenakshi-%';
