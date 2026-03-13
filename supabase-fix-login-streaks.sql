-- SQL Script to fix login_streaks table in Supabase
-- Run this in your Supabase SQL Editor

-- Add missing columns to login_streaks table
ALTER TABLE login_streaks 
  ADD COLUMN IF NOT EXISTS last_login_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS login_dates JSONB DEFAULT '[]'::jsonb;

-- If the table doesn't exist at all, create it:
-- CREATE TABLE IF NOT EXISTS login_streaks (
--   id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id VARCHAR UNIQUE NOT NULL,
--   current_streak INTEGER DEFAULT 0,
--   longest_streak INTEGER DEFAULT 0,
--   total_points INTEGER DEFAULT 0,
--   last_login_date TIMESTAMP,
--   login_dates JSONB DEFAULT '[]'::jsonb,
--   weekly_calendar JSONB DEFAULT '[false, false, false, false, false, false, false]'::jsonb
-- );

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'login_streaks'
ORDER BY ordinal_position;
