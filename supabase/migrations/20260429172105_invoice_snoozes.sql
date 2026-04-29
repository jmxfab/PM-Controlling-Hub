-- Pro offene Rechnung: Snooze-Erinnerung "in X Tagen wieder anzeigen".
-- Solange snoozed_until > heute ist die Rechnung im Cash-Tab "Offen"-
-- Tiles ausgeblendet. Wenn der User eine neue Notiz setzt, wird die
-- API snoozed_until auf today + 7 setzen → effektiv 7 Tage Pause.

CREATE TABLE IF NOT EXISTS public.invoice_snoozes (
  invoice_id   text PRIMARY KEY,
  snoozed_until date NOT NULL,
  note          text,
  snoozed_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  user_email    text
);

CREATE INDEX IF NOT EXISTS invoice_snoozes_until_idx
  ON public.invoice_snoozes (snoozed_until);

COMMENT ON TABLE public.invoice_snoozes IS
  'Pro offene Rechnung: Snooze-Erinnerung "in X Tagen wieder anzeigen". snoozed_until > heute = ausgeblendet im Cash-Tab.';

ALTER TABLE public.invoice_snoozes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_invoice_snoozes ON public.invoice_snoozes;
CREATE POLICY deny_all_invoice_snoozes ON public.invoice_snoozes
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
