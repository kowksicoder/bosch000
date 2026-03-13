
-- First, verify that public.users table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'public.users table does not exist. Please run the main migration first.';
  END IF;
END $$;

-- Drop existing tables if they exist (optional - uncomment if needed)
-- DROP TABLE IF EXISTS login_streaks CASCADE;
-- DROP TABLE IF EXISTS follows CASCADE;

-- Create login_streaks table
CREATE TABLE IF NOT EXISTS public.login_streaks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  last_login_date TIMESTAMP,
  login_dates JSONB DEFAULT '[]'::jsonb,
  weekly_calendar JSONB DEFAULT '[false,false,false,false,false,false,false]'::jsonb
);

-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_address TEXT NOT NULL,
  following_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint to login_streaks
DO $$ 
BEGIN
  -- Check if constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'login_streaks_user_id_users_id_fk'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.login_streaks 
    ADD CONSTRAINT login_streaks_user_id_users_id_fk 
    FOREIGN KEY (user_id) REFERENCES public.users(id);
    
    RAISE NOTICE 'Foreign key constraint added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_login_streaks_user ON public.login_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_address);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_address);

-- Verify the tables were created
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('login_streaks', 'follows', 'users')
ORDER BY table_name, ordinal_position;
