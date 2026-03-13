
-- Run this entire file in the Supabase SQL Editor
-- This consolidates all necessary migrations

-- First, run the main migration
-- (Copy contents from migrations/0000_bizarre_mad_thinker.sql here)

-- Then, fix the follows and login_streaks tables
DO $$
BEGIN
  -- Ensure users.wallet_address is unique before adding foreign keys
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'users_wallet_address_unique'
    ) THEN
      -- Only add unique constraint if there are no duplicate non-null wallet addresses
      IF (
        SELECT COUNT(*) FROM users WHERE wallet_address IS NOT NULL
      ) = (
        SELECT COUNT(DISTINCT wallet_address) FROM users WHERE wallet_address IS NOT NULL
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address);
      END IF;
    END IF;
  END IF;

  -- Check if follows table exists in public schema
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'follows'
  ) THEN
    -- Add foreign key constraints if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'follows_follower_address_users_wallet_address_fk'
    ) THEN
      ALTER TABLE follows 
      ADD CONSTRAINT follows_follower_address_users_wallet_address_fk 
      FOREIGN KEY (follower_address) REFERENCES users(wallet_address);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'follows_following_address_users_wallet_address_fk'
    ) THEN
      ALTER TABLE follows 
      ADD CONSTRAINT follows_following_address_users_wallet_address_fk 
      FOREIGN KEY (following_address) REFERENCES users(wallet_address);
    END IF;
  END IF;

  -- Check if login_streaks table exists
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'login_streaks'
  ) THEN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'login_streaks_user_id_users_id_fk'
    ) THEN
      ALTER TABLE login_streaks 
      ADD CONSTRAINT login_streaks_user_id_users_id_fk 
      FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
  END IF;
END $$;
