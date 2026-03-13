-- Add reward fulfillment fields to user_missions
ALTER TABLE IF EXISTS user_missions
  ADD COLUMN IF NOT EXISTS reward_status VARCHAR,
  ADD COLUMN IF NOT EXISTS reward_delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reward_delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS reward_delivery_value TEXT;
