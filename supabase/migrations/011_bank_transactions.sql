-- ============================================================
-- Migration 011: bank_transactions table
-- Raw AA transaction storage, surfaces in financial timeline
-- ============================================================

create table if not exists bank_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  -- Setu / AA identifiers
  consent_id text not null,
  data_session_id text,
  fip_id text,
  masked_account_number text,
  link_ref_number text,
  -- Transaction fields (from ReBIT schema)
  txn_id text not null,
  amount numeric(15, 2) not null,
  txn_type text not null check (txn_type in ('CREDIT', 'DEBIT')),
  mode text,
  narration text,
  reference text,
  transaction_timestamp timestamptz,
  value_date date,
  current_balance numeric(15, 2),
  -- Metadata
  source_type text default 'account_aggregator',
  created_at timestamptz default now(),
  -- Prevent duplicate insertions on re-delivery
  unique (user_id, txn_id)
);

alter table bank_transactions enable row level security;
drop policy if exists "Users see own transactions" on bank_transactions;
create policy "Users see own transactions" on bank_transactions
  for all using (auth.uid() = user_id);

-- Index for fast timeline queries
create index if not exists bank_transactions_user_ts_idx
  on bank_transactions (user_id, transaction_timestamp desc);
