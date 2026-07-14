-- ============================================================
-- Meenakshi — Notification & AI Briefing Engine
-- Migration 002: pg_cron schedules for Edge Functions
--
-- IST = UTC+5:30
--   7:00 AM IST  = 01:30 UTC  → cron: '30 1 * * *'
--   6:00 PM IST (Sunday) = 12:30 UTC Sunday → cron: '30 12 * * 0'
--
-- Requires pg_cron + pg_net extensions enabled on the project.
-- Run from Supabase Dashboard → SQL Editor.
-- Replace <SERVICE_ROLE_KEY> with your actual service role key before running.
-- ============================================================

-- Enable required extensions (idempotent)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Daily briefing: 7:00 AM IST every day ──────────────────
select cron.schedule(
  'meenakshi-daily-briefing',      -- job name (unique)
  '30 1 * * *',                    -- 01:30 UTC = 7:00 AM IST
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

-- ── Weekly digest: Sunday 6:00 PM IST ──────────────────────
select cron.schedule(
  'meenakshi-weekly-digest',       -- job name (unique)
  '30 12 * * 0',                   -- 12:30 UTC Sunday = 6:00 PM IST Sunday
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

-- ── Verify schedules are registered ────────────────────────
select jobid, jobname, schedule, command
from cron.job
where jobname like 'meenakshi-%';
