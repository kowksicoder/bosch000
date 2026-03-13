
-- Add pin_order column to coins table for pinning functionality
ALTER TABLE coins 
ADD COLUMN IF NOT EXISTS pin_order INTEGER;

-- Add an index for better query performance on pinned coins
CREATE INDEX IF NOT EXISTS idx_coins_pin_order ON coins(pin_order) WHERE pin_order IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'coins' AND column_name = 'pin_order';
