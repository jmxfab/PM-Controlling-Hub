-- Promote key fields on hero_receipts from raw JSONB to typed columns.
-- Previously only id/modified/created were fetched; the sync now requests
-- financial and project-link fields so Deckungsbeitrag queries can join them.

ALTER TABLE public.hero_receipts
  ADD COLUMN IF NOT EXISTS project_match_id  TEXT,
  ADD COLUMN IF NOT EXISTS partner_id        TEXT,
  ADD COLUMN IF NOT EXISTS value             NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vat               NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS currency          TEXT,
  ADD COLUMN IF NOT EXISTS category_id       TEXT,
  ADD COLUMN IF NOT EXISTS category_name     TEXT,
  ADD COLUMN IF NOT EXISTS status_code       INT,
  ADD COLUMN IF NOT EXISTS status_name       TEXT,
  ADD COLUMN IF NOT EXISTS receipt_date      DATE,
  ADD COLUMN IF NOT EXISTS nr                TEXT;

CREATE INDEX IF NOT EXISTS hero_receipts_project_idx
  ON public.hero_receipts (project_match_id);

CREATE INDEX IF NOT EXISTS hero_receipts_date_idx
  ON public.hero_receipts (receipt_date DESC);
