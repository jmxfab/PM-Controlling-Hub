-- Promote already-fetched fields from raw JSONB to typed columns.
-- contacts.ts already fetches phone_mobile; partners.ts already fetches role, status, user_id.
-- No sync-script changes needed — fields land in raw and are written here on next sync.

ALTER TABLE public.hero_contacts
  ADD COLUMN IF NOT EXISTS phone_mobile TEXT;

ALTER TABLE public.hero_partners
  ADD COLUMN IF NOT EXISTS role     TEXT,
  ADD COLUMN IF NOT EXISTS status   TEXT,
  ADD COLUMN IF NOT EXISTS user_id  TEXT;
