-- ============================================================
-- Phase 2: Document Vault Migration
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Table: documents
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  file_type text not null, -- 'pdf' or 'image'
  storage_path text not null,
  document_type text, -- 'salary_slip', 'bank_statement', etc.
  summary text,
  key_dates jsonb default '[]'::jsonb,
  obligations jsonb default '[]'::jsonb,
  actions jsonb default '[]'::jsonb,
  entities jsonb default '[]'::jsonb,
  raw_extracted_text text,
  processed boolean default false,
  uploaded_at timestamptz default now()
);

-- RLS for documents table
alter table documents enable row level security;

drop policy if exists "Users can manage their own documents" on documents;
create policy "Users can manage their own documents" on documents
  for all using (auth.uid() = user_id);

-- Storage: create documents bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Storage Policy: Users can view their own documents
drop policy if exists "Users can view own documents" on storage.objects;
create policy "Users can view own documents" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() = owner);

-- Storage Policy: Users can insert their own documents
drop policy if exists "Users can insert own documents" on storage.objects;
create policy "Users can insert own documents" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid() = owner);

-- Storage Policy: Users can delete their own documents
drop policy if exists "Users can delete own documents" on storage.objects;
create policy "Users can delete own documents" on storage.objects
  for delete using (bucket_id = 'documents' and auth.uid() = owner);
