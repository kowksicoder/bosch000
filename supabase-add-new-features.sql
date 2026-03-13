
-- Comment Reactions Table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  comment_id VARCHAR NOT NULL,
  user_address VARCHAR NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comment_id, user_address, emoji)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_address);

-- User Badges Table
CREATE TABLE IF NOT EXISTS user_badges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  badge_type VARCHAR NOT NULL,
  badge_name VARCHAR NOT NULL,
  badge_icon VARCHAR,
  description TEXT,
  earned_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_type ON user_badges(badge_type);

-- Trade History Table (detailed)
CREATE TABLE IF NOT EXISTS trade_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_address VARCHAR NOT NULL,
  coin_address VARCHAR NOT NULL,
  coin_symbol VARCHAR,
  trade_type VARCHAR NOT NULL, -- 'buy' or 'sell'
  amount_eth VARCHAR NOT NULL,
  amount_tokens VARCHAR,
  price_per_token VARCHAR,
  total_value_usd VARCHAR,
  transaction_hash VARCHAR,
  block_number BIGINT,
  gas_used VARCHAR,
  gas_price VARCHAR,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_trade_history_user ON trade_history(user_address);
CREATE INDEX idx_trade_history_coin ON trade_history(coin_address);
CREATE INDEX idx_trade_history_timestamp ON trade_history(timestamp DESC);

-- Creator Stories Table
CREATE TABLE IF NOT EXISTS creator_stories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  creator_address VARCHAR NOT NULL,
  content_type VARCHAR DEFAULT 'image', -- 'image', 'video', 'text'
  content_url TEXT,
  text_content TEXT,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 86400, -- 24 hours in seconds
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_creator_stories_creator ON creator_stories(creator_address);
CREATE INDEX idx_creator_stories_active ON creator_stories(is_active, expires_at);

-- Story Views Table
CREATE TABLE IF NOT EXISTS story_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  story_id VARCHAR NOT NULL,
  viewer_address VARCHAR NOT NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(story_id, viewer_address)
);

CREATE INDEX idx_story_views_story ON story_views(story_id);
CREATE INDEX idx_story_views_viewer ON story_views(viewer_address);

-- Search History Table
CREATE TABLE IF NOT EXISTS search_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_address VARCHAR,
  search_query VARCHAR NOT NULL,
  search_type VARCHAR DEFAULT 'general', -- 'general', 'creator', 'coin'
  result_count INTEGER DEFAULT 0,
  clicked_result VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_history_user ON search_history(user_address);
CREATE INDEX idx_search_history_query ON search_history(search_query);
CREATE INDEX idx_search_history_timestamp ON search_history(created_at DESC);
