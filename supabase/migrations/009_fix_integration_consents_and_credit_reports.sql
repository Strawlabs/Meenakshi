-- ============================================================
-- Migration 009: Fix integration_consents + credit_reports
-- ============================================================

-- 1. Expand the integration CHECK constraint to include bank_account and credit_report.
--    ALTER TABLE ... ALTER COLUMN ... SET CHECK is not a thing in Postgres;
--    we must drop the old constraint and add the new one.
ALTER TABLE integration_consents
  DROP CONSTRAINT IF EXISTS integration_consents_integration_check;

ALTER TABLE integration_consents
  ADD CONSTRAINT integration_consents_integration_check
  CHECK (integration IN (
    'gmail', 'contacts', 'calendar',
    'document_vault', 'business_card',
    'bank_account', 'credit_report'
  ));

-- 2. Add robustness columns to credit_reports (from migration 008, safe to re-run with IF NOT EXISTS).
ALTER TABLE credit_reports
  ADD COLUMN IF NOT EXISTS storage_path  text,
  ADD COLUMN IF NOT EXISTS file_type     text,
  ADD COLUMN IF NOT EXISTS status        text DEFAULT 'pending'
    CHECK (status IN ('pending', 'parsed', 'failed')),
  ADD COLUMN IF NOT EXISTS error_message text;
