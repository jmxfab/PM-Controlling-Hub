-- Hero CustomerDocument.customer_document_booking → typed columns
--
-- Hero stores invoice payment status in a sub-entity
-- `CustomerDocumentBooking` reachable from CustomerDocument via the
-- `customer_document_booking` field. We sync four high-value fields
-- as typed columns so we can index/filter cleanly without going
-- through the raw JSONB on every query:
--
--   booking_is_open    BOOLEAN  — is this invoice still open (= unpaid)?
--   booking_paid_date  DATE     — when did the customer pay it?
--   booking_due_date   DATE     — Hero's own payment-due date
--   booking_balance    NUMERIC  — remaining open amount (partial payments)
--
-- This unblocks the Cash-Tab "Offen & ..."-Kacheln from der status_code-
-- Heuristik onto Hero's actual paid/unpaid + due-date data.
--
-- Note: hero_dashboard_projects ist eine MATERIALIZED VIEW. Wir lassen
-- ihre Definition hier UNVERAENDERT — die Cash-Loader queryen direkt auf
-- hero_customer_documents.booking_is_open. Eine eigene Folge-Migration
-- kann die MV spaeter aktualisieren wenn wir auch den Rest des
-- Dashboards (Insights/Pipeline) auf das booking-basierte Open-Modell
-- umstellen.

ALTER TABLE public.hero_customer_documents
  ADD COLUMN IF NOT EXISTS booking_is_open    boolean,
  ADD COLUMN IF NOT EXISTS booking_paid_date  date,
  ADD COLUMN IF NOT EXISTS booking_due_date   date,
  ADD COLUMN IF NOT EXISTS booking_balance    numeric;

COMMENT ON COLUMN public.hero_customer_documents.booking_is_open
  IS 'Aus CustomerDocumentBooking.is_open — TRUE = Rechnung noch offen (unbezahlt).';
COMMENT ON COLUMN public.hero_customer_documents.booking_paid_date
  IS 'Aus CustomerDocumentBooking.paid_date — Zahlungseingangs-Datum.';
COMMENT ON COLUMN public.hero_customer_documents.booking_due_date
  IS 'Aus CustomerDocumentBooking.due_date — Hero-Faelligkeitsdatum.';
COMMENT ON COLUMN public.hero_customer_documents.booking_balance
  IS 'Aus CustomerDocumentBooking.balance — Rest-offener Betrag (Teilzahlung).';

CREATE INDEX IF NOT EXISTS hero_customer_documents_booking_is_open_idx
  ON public.hero_customer_documents (booking_is_open)
  WHERE booking_is_open = true;

CREATE INDEX IF NOT EXISTS hero_customer_documents_booking_paid_date_idx
  ON public.hero_customer_documents (booking_paid_date)
  WHERE booking_paid_date IS NOT NULL;
