-- ============================================================
-- Phase 2: Financial Data Integrations (Account Aggregator & Credit Reports)
-- ============================================================

-- Table 1: aa_consents
create table if not exists aa_consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  consent_handle text not null,
  consent_id text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REJECTED','EXPIRED','REVOKED')),
  fi_types text[] not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table aa_consents enable row level security;
drop policy if exists "Users see own consents" on aa_consents;
create policy "Users see own consents" on aa_consents 
  for all using (auth.uid() = user_id);

-- Table 2: linked_bank_accounts
create table if not exists linked_bank_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  consent_id uuid references aa_consents(id) on delete cascade,
  fip_id text not null,
  masked_account_number text,
  account_type text,
  linked_at timestamptz default now()
);

alter table linked_bank_accounts enable row level security;
drop policy if exists "Users see own accounts" on linked_bank_accounts;
create policy "Users see own accounts" on linked_bank_accounts 
  for all using (auth.uid() = user_id);

-- Table 3: credit_reports
create table if not exists credit_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text not null,
  credit_score integer,
  extracted_data jsonb,
  uploaded_at timestamptz default now()
);

alter table credit_reports enable row level security;
drop policy if exists "Users see own credit reports" on credit_reports;
create policy "Users see own credit reports" on credit_reports 
  for all using (auth.uid() = user_id);

-- Optional: Create storage bucket for credit reports if not exists (using RPC or manually in dashboard)
insert into storage.buckets (id, name, public) 
values ('credit_reports_bucket', 'credit_reports_bucket', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own credit reports" on storage.objects;
create policy "Users can upload their own credit reports"
  on storage.objects for insert
  with check (bucket_id = 'credit_reports_bucket' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view their own credit reports" on storage.objects;
create policy "Users can view their own credit reports"
  on storage.objects for select
  using (bucket_id = 'credit_reports_bucket' and auth.uid()::text = (storage.foldername(name))[1]);

-- Cron job for fetching FI data daily at 3:00 AM IST = 21:30 UTC
-- Note: Requires pg_cron and pg_net extensions (already enabled in ALL_MIGRATIONS_RUN_IN_SUPABASE.sql)
select cron.unschedule('meenakshi-fetch-fi-data') where exists (
  select 1 from cron.job where jobname = 'meenakshi-fetch-fi-data'
);
select cron.schedule(
  'meenakshi-fetch-fi-data',
  '30 21 * * *',
  $$
    select net.http_post(
      url     := 'https://cwdcwapftsfvptlpquky.supabase.co/functions/v1/aa-fetch-fi-data',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);
