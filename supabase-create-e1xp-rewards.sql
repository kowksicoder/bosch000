
-- Create e1xp_rewards table for tracking claimable rewards
CREATE TABLE IF NOT EXISTS e1xp_rewards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_user_id ON e1xp_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_claimed ON e1xp_rewards(claimed);
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_type ON e1xp_rewards(type);

-- Add foreign key constraints if tables exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'creators') THEN
    ALTER TABLE e1xp_rewards 
    ADD CONSTRAINT fk_e1xp_rewards_user 
    FOREIGN KEY (user_id) REFERENCES creators(address) ON DELETE CASCADE;
  END IF;
END $$;
