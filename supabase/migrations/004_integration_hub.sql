-- ============================================================
-- Phase 1: Integration Hub Migrations
-- ============================================================

-- Table 1: integration_consents
create table if not exists integration_consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  integration text not null check (integration in 
    ('gmail','contacts','calendar','document_vault','business_card')),
  status text not null default 'disconnected' check (status in 
    ('connected','disconnected','pending','error')),
  scopes_granted text[],
  connected_at timestamptz,
  revoked_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  unique(user_id, integration)
);

alter table integration_consents enable row level security;
drop policy if exists "Users manage own consents" on integration_consents;
create policy "Users manage own consents" on integration_consents 
  for all using (auth.uid() = user_id);

-- Table 2: calendar_events
create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  attendees jsonb,
  source_calendar_id text,
  created_at timestamptz default now()
);

alter table calendar_events enable row level security;
drop policy if exists "Users manage own events" on calendar_events;
create policy "Users manage own events" on calendar_events 
  for all using (auth.uid() = user_id);
