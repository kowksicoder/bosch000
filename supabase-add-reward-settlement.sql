ALTER TABLE "rewards"
ADD COLUMN IF NOT EXISTS "reward_amount_usd" numeric(18,8),
ADD COLUMN IF NOT EXISTS "reward_amount_ngn" numeric(18,2),
ADD COLUMN IF NOT EXISTS "settled" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "settled_at" timestamp,
ADD COLUMN IF NOT EXISTS "settlement_reference" text;
