-- ============================================================
-- Phase 2: Add source_type to email_events to distinguish sources
-- ============================================================

-- Add source_type column with check constraint
ALTER TABLE email_events 
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'gmail' 
CHECK (source_type in ('gmail', 'account_aggregator', 'manual', 'sandbox_mock'));

-- Update existing Sandbox Mock transactions that were inserted with 'UPI/Setu/Test' subject
UPDATE email_events
SET source_type = 'sandbox_mock'
WHERE subject = 'UPI/Setu/Test' AND category = 'bank_transaction';

-- Note: The meenakshi-fetch-fi-data pg_cron schedule remains disabled for now
-- select cron.schedule('meenakshi-fetch-fi-data', ...); 
-- is explicitly omitted until testing is complete.
