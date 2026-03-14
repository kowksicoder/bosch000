-- E1XP core tables + columns (safe to run multiple times)
-- Run this in Supabase SQL Editor for the current project

-- Users: points + badges
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS e1xp_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_badges JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Creators: keep points for UI sync
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS points VARCHAR DEFAULT '0';

-- Points transactions (ledger)
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON public.points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON public.points_transactions(type);

-- Login streaks (stored by address/privy id string)
CREATE TABLE IF NOT EXISTS public.login_streaks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  last_login_date TIMESTAMP,
  login_dates JSONB DEFAULT '[]'::jsonb,
  weekly_calendar JSONB DEFAULT '[false,false,false,false,false,false,false]'::jsonb
);

-- If a FK exists from login_streaks.user_id -> users.id, drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'login_streaks_user_id_users_id_fk'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.login_streaks
      DROP CONSTRAINT login_streaks_user_id_users_id_fk;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_login_streaks_user ON public.login_streaks(user_id);

-- E1XP rewards (claimables)
CREATE TABLE IF NOT EXISTS public.e1xp_rewards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMP,
  coin_id VARCHAR,
  referral_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reminder_sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_user_id ON public.e1xp_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_claimed ON public.e1xp_rewards(claimed);
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_type ON public.e1xp_rewards(type);
