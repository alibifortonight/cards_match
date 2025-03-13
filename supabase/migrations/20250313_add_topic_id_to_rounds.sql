-- Add topic_id column to rounds table
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS topic_id TEXT;
