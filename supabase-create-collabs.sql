
-- Collabs table
CREATE TABLE IF NOT EXISTS collabs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  coin_id VARCHAR,
  coin_address TEXT,
  title TEXT,
  created_by TEXT NOT NULL,
  status VARCHAR DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collabs_coin_id ON collabs(coin_id);
CREATE INDEX IF NOT EXISTS idx_collabs_coin_address ON collabs(coin_address);
CREATE INDEX IF NOT EXISTS idx_collabs_created_by ON collabs(created_by);

-- Collab members table
CREATE TABLE IF NOT EXISTS collab_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  collab_id VARCHAR NOT NULL,
  member_id TEXT NOT NULL,
  role VARCHAR DEFAULT 'creator',
  split_bps INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collab_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_members_collab ON collab_members(collab_id);
CREATE INDEX IF NOT EXISTS idx_collab_members_member ON collab_members(member_id);

-- Collab invites table
CREATE TABLE IF NOT EXISTS collab_invites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  collab_id VARCHAR NOT NULL,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  status VARCHAR DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  UNIQUE(collab_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_invites_collab ON collab_invites(collab_id);
CREATE INDEX IF NOT EXISTS idx_collab_invites_invitee ON collab_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_collab_invites_status ON collab_invites(status);
