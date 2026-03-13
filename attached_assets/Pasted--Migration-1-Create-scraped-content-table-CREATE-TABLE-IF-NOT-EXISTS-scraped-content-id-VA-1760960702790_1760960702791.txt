-- Migration 1

-- Create scraped_content table
CREATE TABLE IF NOT EXISTS scraped_content (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'blog',
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  publish_date TEXT,
  image TEXT,
  content TEXT,
  tags JSONB,
  metadata JSONB,
  scraped_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create coins table
CREATE TABLE IF NOT EXISTS coins (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  address TEXT,
  creator_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scraped_content_id VARCHAR REFERENCES scraped_content(id),
  ipfs_uri TEXT,
  chain_id TEXT,
  registry_tx_hash TEXT,
  metadata_hash TEXT,
  registered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  image TEXT,
  description TEXT
);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL,
  coin_address TEXT NOT NULL,
  coin_symbol TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  reward_amount TEXT NOT NULL,
  reward_currency TEXT NOT NULL DEFAULT 'ZORA',
  recipient_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  coin_address TEXT,
  coin_symbol TEXT,
  amount TEXT,
  transaction_hash TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  address TEXT NOT NULL UNIQUE,
  name TEXT,
  bio TEXT,
  avatar TEXT,
  verified TEXT NOT NULL DEFAULT 'false',
  total_coins TEXT NOT NULL DEFAULT '0',
  total_volume TEXT NOT NULL DEFAULT '0',
  followers TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  coin_address TEXT NOT NULL,
  user_address TEXT NOT NULL,
  comment TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_coins_address ON coins(address);
CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_coins_status ON coins(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_creators_address ON creators(address);
CREATE INDEX IF NOT EXISTS idx_comments_coin ON comments(coin_address);
CREATE INDEX IF NOT EXISTS idx_rewards_coin ON rewards(coin_address);
CREATE INDEX IF NOT EXISTS idx_rewards_recipient ON rewards(recipient_address);


-- Migration 2

-- Add missing columns to existing coins table (if it exists as zora_coins)
ALTER TABLE coins ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coins ADD COLUMN IF NOT EXISTS image TEXT;

-- If your table is named zora_coins, rename it:
-- ALTER TABLE zora_coins RENAME TO coins;


-- Migration 3

-- Create scraped_content table
CREATE TABLE IF NOT EXISTS scraped_content (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'blog',
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  publish_date TEXT,
  image TEXT,
  content TEXT,
  tags JSONB,
  metadata JSONB,
  scraped_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  coin_address TEXT,
  coin_symbol TEXT,
  amount TEXT,
  transaction_hash TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);


-- Migration 4

-- Add missing columns to coins table
ALTER TABLE coins ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE coins ADD COLUMN IF NOT EXISTS description TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'coins' 
ORDER BY ordinal_position;


-- Migration 5

-- Fix creator_wallet column
ALTER TABLE coins ADD COLUMN IF NOT EXISTS creator_wallet TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'coins' 
AND column_name = 'creator_wallet';


-- Migration 6

-- Add missing status column to coins table
ALTER TABLE coins ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'coins' 
AND column_name = 'status';


-- Migration 7

-- Import old coins data with column mapping
-- Transform old column names to new schema

INSERT INTO coins (
  id, 
  name, 
  symbol, 
  address, 
  creator_wallet, 
  status,
  ipfs_uri,
  image,
  description,
  created_at,
  registry_tx_hash
)
SELECT 
  id,
  COALESCE(name, token_name) as name,
  COALESCE(symbol, token_symbol) as symbol,
  coin_address as address,
  creator_wallet,
  'active' as status,
  ipfs_uri,
  COALESCE(
    (metadata::json->>'image'),
    gateway_url
  ) as image,
  COALESCE(
    (metadata::json->>'description'),
    (metadata::json->>'title')
  ) as description,
  created_at,
  transaction_hash as registry_tx_hash
FROM (VALUES
  ('085bbf2d-ea9a-4311-a93c-81efe81c4e03', NULL, '0xd4eC4b5D04EB1cc6344f25611542E540Da3AcBF7', NULL, NULL, NULL, '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7', '0xf32a87327eb785d7c62bccc72e04099c36f6d9ac6795671edd44694f155b3be1', '2025-09-25 00:03:55.594818', '2025-09-25 00:03:55.594818', 'https://yellow-patient-cheetah-559.mypinata.cloud/ipfs/bafkreihrnjn4hj6wozky2ss357ma7ewasghxjovzpyykagy5c5qqkt5x3i', 'bafkreihrnjn4hj6wozky2ss357ma7ewasghxjovzpyykagy5c5qqkt5x3i', 'ipfs://bafkreihrnjn4hj6wozky2ss357ma7ewasghxjovzpyykagy5c5qqkt5x3i', '{"tags":[],"type":"image","image":"https://zora.co/api/og-image/coin/base:0xde7c9a53edd5ef151210aa7c1da9dc80068547ab","title":"Test this test that","author":"","content":"","description":"A coin representing the blog post: Why Every Senior Developer I Know Is Planning Their Exit | by Harishsingh | Sep, 2025 | Medium","originalUrl":"https://zora.co/coin/base:0xde7c9a53edd5ef151210aa7c1da9dc80068547ab","publishDate":""}', 'Test this test that', 'TESTTHIS'),
  ('5802d950-d913-4fc2-b4ef-5d4c2f1db213', NULL, '0x509059DBB581927C8641673126eBACD46AC359Ca', NULL, NULL, NULL, '0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7', '0xa0a1215e52ede64b456c92987c4ce6547ba53e309ae80ec064b1e06865f9f6ca', '2025-09-25 16:07:43.724032', '2025-09-25 16:07:43.724032', NULL, NULL, NULL, '{}', 'Test Coin 2', 'TEST2')
) AS old_data(
  id, blog_post_id, coin_address, coin_id, token_name, token_symbol, 
  creator_wallet, transaction_hash, created_at, updated_at, 
  gateway_url, ipfs_hash, ipfs_uri, metadata, name, symbol
)
ON CONFLICT (id) DO UPDATE SET
  address = EXCLUDED.address,
  registry_tx_hash = EXCLUDED.registry_tx_hash,
  status = 'active';

-- Verify import
SELECT COUNT(*) as imported_coins FROM coins WHERE status = 'active';


-- Migration 8

-- Add referral code and points columns to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS points TEXT NOT NULL DEFAULT '0';

-- Create index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_creators_referral_code ON creators(referral_code);


-- Migration 9

-- Add profileImage column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS "profileImage" TEXT;


