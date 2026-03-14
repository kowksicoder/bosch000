-- Add points column to creators for E1XP display parity
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS points VARCHAR DEFAULT '0';

CREATE INDEX IF NOT EXISTS idx_creators_points ON creators(points);
