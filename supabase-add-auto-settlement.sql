ALTER TABLE "creators"
ADD COLUMN IF NOT EXISTS "auto_settlement_enabled" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "auto_settlement_address" varchar(42),
ADD COLUMN IF NOT EXISTS "auto_settlement_updated_at" timestamp;
