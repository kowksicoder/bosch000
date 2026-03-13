
-- Add hidden column to coins table
ALTER TABLE coins ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
