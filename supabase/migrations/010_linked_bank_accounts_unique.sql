-- Migration 010: Add unique constraint to linked_bank_accounts
-- Required for correct upsert deduplication in aa-fetch-fi-data.
-- Without this, every FI data fetch inserts duplicate account rows.

ALTER TABLE linked_bank_accounts
  ADD UNIQUE (user_id, fip_id, masked_account_number);
