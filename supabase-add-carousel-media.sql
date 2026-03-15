-- Adds support for carousel media metadata on scraped content.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.scraped_content
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.scraped_content
  ADD COLUMN IF NOT EXISTS animation_url text;

ALTER TABLE IF EXISTS public.scraped_content
  ADD COLUMN IF NOT EXISTS image text;

ALTER TABLE IF EXISTS public.scraped_content
  ADD COLUMN IF NOT EXISTS type text;
