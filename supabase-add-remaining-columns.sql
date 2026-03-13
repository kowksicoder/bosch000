-- SQL Script to add remaining missing columns to login_streaks table
-- Run this in your Supabase SQL Editor

-- Add missing columns
ALTER TABLE login_streaks 
  ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_calendar JSONB DEFAULT '[false, false, false, false, false, false, false]'::jsonb;

-- Verify all columns are present
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'login_streaks'
ORDER BY ordinal_position;
