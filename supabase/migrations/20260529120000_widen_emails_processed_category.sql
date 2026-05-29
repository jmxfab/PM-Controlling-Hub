-- Fix: emails_processed.category lehnte 2 von 5 Klassifizierungs-Kategorien ab.
-- Der Klassifizierer (src/lib/anthropic/email-classifier.ts) liefert auch
-- 'pl_aufgabe' und 'gf_aufgabe'; der Insert in cron/process-emails schlug
-- dadurch mit check_violation (23514) fehl und die Mail ging verloren.
-- Wir weiten den CHECK auf die volle Kategorie-Liste (analog VALID_CATEGORY
-- in src/app/api/mail-tasks/route.ts).

ALTER TABLE public.emails_processed
  DROP CONSTRAINT IF EXISTS emails_processed_category_check;

ALTER TABLE public.emails_processed
  ADD CONSTRAINT emails_processed_category_check
  CHECK (category IN (
    'info', 'aufgabe', 'dringend', 'pl_aufgabe', 'gf_aufgabe',
    'kritisch', 'inbox', 'rechnung', 'bestellung'
  ));
