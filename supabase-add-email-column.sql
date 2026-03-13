
-- Add email column to creators table
ALTER TABLE creators 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_email ON creators(email);

-- Update existing email users to populate their email field
-- This will extract the email from address field for users with email_ prefix
UPDATE creators 
SET email = CASE 
  WHEN address LIKE 'email_%' THEN 
    -- This is a placeholder - actual emails need to be synced from Privy
    NULL
  ELSE NULL
END
WHERE email IS NULL;
