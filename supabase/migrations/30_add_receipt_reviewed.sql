-- Add receipt_reviewed column to transactions table
ALTER TABLE transactions ADD COLUMN receipt_reviewed BOOLEAN DEFAULT FALSE;
