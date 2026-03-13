
-- Add wallet_address column to creators table
ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42);

-- Add comment to explain the column
COMMENT ON COLUMN creators.wallet_address IS 'Optional wallet address for receiving onchain trade rewards';
