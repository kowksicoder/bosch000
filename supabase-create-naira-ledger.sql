CREATE TABLE IF NOT EXISTS "naira_ledger" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "recipient_address" text NOT NULL UNIQUE,
  "available_ngn" numeric(18,2) DEFAULT 0,
  "pending_ngn" numeric(18,2) DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "naira_ledger_entries" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "recipient_address" text NOT NULL,
  "entry_type" text NOT NULL,
  "amount_ngn" numeric(18,2) NOT NULL,
  "source" text NOT NULL,
  "reference" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
