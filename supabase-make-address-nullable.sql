-- Make address column nullable to support email-only users
ALTER TABLE creators ALTER COLUMN address DROP NOT NULL;

-- Add a unique constraint that allows multiple null values
-- This ensures wallet addresses are unique when provided
DROP INDEX IF EXISTS creators_address_key;
CREATE UNIQUE INDEX creators_address_unique ON creators (address) WHERE address IS NOT NULL AND address NOT LIKE 'email_%';
