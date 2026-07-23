-- Add new columns for credit report robustness
ALTER TABLE credit_reports
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'failed')),
  ADD COLUMN IF NOT EXISTS error_message text;
