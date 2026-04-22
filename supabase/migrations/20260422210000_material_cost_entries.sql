-- Manual material cost entries for Deckungsbeitrag calculation.
-- Hero does not provide material costs; this table allows Controlling staff
-- to enter them manually until a DATEV/ERP integration is available.

CREATE TABLE IF NOT EXISTS public.material_cost_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_match_id TEXT        NOT NULL,
  project_number   TEXT,
  cost_amount      NUMERIC(12,2) NOT NULL,
  cost_type        TEXT        NOT NULL DEFAULT 'material'
                   CHECK (cost_type IN ('material', 'subcontractor', 'other')),
  description      TEXT,
  invoice_ref      TEXT,
  entered_at       DATE        NOT NULL DEFAULT CURRENT_DATE,
  entered_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_costs_project
  ON public.material_cost_entries (project_match_id);

CREATE INDEX IF NOT EXISTS idx_material_costs_date
  ON public.material_cost_entries (entered_at DESC);

ALTER TABLE public.material_cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_costs_auth_read"
  ON public.material_cost_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "material_costs_service_all"
  ON public.material_cost_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);
