
-- Missions table
CREATE TABLE IF NOT EXISTS missions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type VARCHAR NOT NULL,
  coin_address TEXT,
  required_amount NUMERIC(36, 18),
  required_days INTEGER,
  required_actions JSONB,
  reward_type VARCHAR NOT NULL,
  reward_value TEXT,
  status VARCHAR DEFAULT 'active',
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_missions_creator ON missions(creator_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_coin ON missions(coin_address);

-- User missions table
CREATE TABLE IF NOT EXISTS user_missions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  mission_id VARCHAR NOT NULL,
  user_id TEXT NOT NULL,
  status VARCHAR DEFAULT 'in_progress',
  progress INTEGER DEFAULT 0,
  reward_status VARCHAR,
  reward_delivered_at TIMESTAMP,
  reward_delivery_notes TEXT,
  reward_delivery_value TEXT,
  joined_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  claimed_at TIMESTAMP,
  UNIQUE(mission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_mission ON user_missions(mission_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_status ON user_missions(status);
