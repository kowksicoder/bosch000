ALTER TABLE "creators"
ADD COLUMN IF NOT EXISTS "bank_account" varchar(20),
ADD COLUMN IF NOT EXISTS "bank_code" varchar(10),
ADD COLUMN IF NOT EXISTS "bank_name" varchar(80),
ADD COLUMN IF NOT EXISTS "payout_recipient_code" text;
