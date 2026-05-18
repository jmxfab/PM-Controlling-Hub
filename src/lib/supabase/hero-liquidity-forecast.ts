import "server-only";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Liquiditaets-Forecast: offene Ausgangsrechnungen + historisches Zahlungs-
 * verhalten -> erwarteter Geldeingang in 30/60/90 Tagen.
 *
 * Methodik v1 (bewusst simpel, transparent):
 * - Sammle alle offenen Rechnungen (status_code=200, booking_is_open=true)
 *   mit booking_due_date.
 * - Sammle bezahlte Rechnungen der letzten 12 Monate, berechne mittleren
 *   Zahlungsverzug (booking_paid_date - booking_due_date in Tagen).
 * - Verschiebe das booking_due_date jeder offenen Rechnung um diesen
 *   Median-Verzug -> erwartetes Zahlungsdatum.
 * - Bucke nach erwartetem Zahlungsdatum: ueberfaellig | <=30d | <=60d | <=90d | spaeter.
 *
 * Limits in v1:
 * - Kein Department-Filter (alle Sparten zusammen).
 * - Globaler Verzug, nicht pro Kunde — bei groesserer Kundenmix-Heterogenitaet
 *   evtl. spaeter pro Kunde.
 */

export interface LiquidityBucket {
  /** Label-Key fuer das UI */
  key: "overdue" | "in30" | "in60" | "in90" | "later" | "noduedate";
  label: string;
  /** Anzahl Rechnungen in diesem Bucket */
  count: number;
  /** Erwartete Summe (EUR) — Summe der openAmounts mit Verzugs-Adjustment */
  expectedAmount: number;
  /** Rohe Summe ohne Adjustment — zeigt was OHNE Zahlungsverzug eingehen wuerde. */
  rawAmount: number;
}

export interface LiquidityForecast {
  generatedAt: string;
  /** Mittlerer Zahlungsverzug aus den letzten 12 Monaten (Tage; positiv = spaet). */
  meanDelayDays: number;
  /** Median Zahlungsverzug — robuster als mean, wird fuers Adjustment benutzt. */
  medianDelayDays: number;
  /** Anzahl bezahlter Rechnungen aus denen das Verhalten berechnet wurde. */
  sampleSize: number;
  /** Gesamtsumme offene Rechnungen (sum aller openAmounts). */
  totalOpenAmount: number;
  totalOpenCount: number;
  buckets: LiquidityBucket[];
}

type InvoiceRow = {
  value: number | string | null;
  booking_balance: number | string | null;
  booking_due_date: string | null;
  booking_paid_date: string | null;
  booking_is_open: boolean | null;
};

function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export async function loadLiquidityForecast(): Promise<LiquidityForecast> {
  const supabase = supabaseAdmin();
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(now.getMonth() - 12);

  // 1) Offene Rechnungen (status_code=200, booking_is_open=true, mit due_date)
  const { data: openRowsData, error: openErr } = await supabase
    .from("hero_customer_documents")
    .select(
      "value, booking_balance, booking_due_date, booking_paid_date, booking_is_open",
    )
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .eq("booking_is_open", true)
    .limit(10_000);
  if (openErr) throw openErr;
  const openRows: InvoiceRow[] = openRowsData ?? [];

  // 2) Bezahlte Rechnungen der letzten 12 Monate fuer Zahlungsverhalten
  const { data: paidRowsData, error: paidErr } = await supabase
    .from("hero_customer_documents")
    .select("booking_due_date, booking_paid_date")
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .eq("booking_is_open", false)
    .not("booking_paid_date", "is", null)
    .not("booking_due_date", "is", null)
    .gte("booking_paid_date", twelveMonthsAgo.toISOString().slice(0, 10))
    .limit(10_000);
  if (paidErr) throw paidErr;
  const paidRows = paidRowsData ?? [];

  // 3) Mean + Median des Zahlungsverzugs berechnen
  const delays: number[] = [];
  for (const r of paidRows) {
    if (!r.booking_paid_date || !r.booking_due_date) continue;
    const paid = new Date(r.booking_paid_date);
    const due = new Date(r.booking_due_date);
    if (Number.isNaN(paid.getTime()) || Number.isNaN(due.getTime())) continue;
    const d = daysBetween(paid, due);
    // Outlier-Filter: Werte ueber 365 Tage (Sondervorgaenge, Mahnverfahren etc.)
    // verzerren das Mittel uebermaessig. Bei -90..+365 ist die Verteilung
    // praktisch noch interpretierbar.
    if (d < -90 || d > 365) continue;
    delays.push(d);
  }

  let meanDelayDays = 0;
  let medianDelayDays = 0;
  if (delays.length > 0) {
    meanDelayDays = delays.reduce((s, d) => s + d, 0) / delays.length;
    const sorted = [...delays].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDelayDays =
      sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
  }

  // 4) Buckets fuer offene Rechnungen — basiert auf erwartetem Zahlungsdatum
  //    (= booking_due_date + medianDelayDays). Negative Werte = ueberfaellig.
  const buckets: Record<LiquidityBucket["key"], LiquidityBucket> = {
    overdue: {
      key: "overdue",
      label: "Überfällig",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
    in30: {
      key: "in30",
      label: "Nächste 30 Tage",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
    in60: {
      key: "in60",
      label: "31 – 60 Tage",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
    in90: {
      key: "in90",
      label: "61 – 90 Tage",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
    later: {
      key: "later",
      label: "Später (>90 Tage)",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
    noduedate: {
      key: "noduedate",
      label: "Ohne Fälligkeit",
      count: 0,
      expectedAmount: 0,
      rawAmount: 0,
    },
  };

  let totalOpenAmount = 0;
  let totalOpenCount = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const r of openRows) {
    const openAmt = toNum(r.booking_balance) ?? toNum(r.value);
    if (openAmt == null || openAmt <= 0) continue;
    totalOpenAmount += openAmt;
    totalOpenCount += 1;

    if (!r.booking_due_date) {
      buckets.noduedate.count += 1;
      buckets.noduedate.expectedAmount += openAmt;
      buckets.noduedate.rawAmount += openAmt;
      continue;
    }
    const due = new Date(r.booking_due_date);
    if (Number.isNaN(due.getTime())) {
      buckets.noduedate.count += 1;
      buckets.noduedate.expectedAmount += openAmt;
      buckets.noduedate.rawAmount += openAmt;
      continue;
    }

    // Rohe Distanz (ohne Adjustment) — fuers rawAmount-Feld
    const daysToDue = daysBetween(due, today);
    // Erwartete Distanz (mit Adjustment) — verschiebt um Median-Verzug
    const daysToExpected = daysToDue + medianDelayDays;

    const bucket: LiquidityBucket["key"] =
      daysToExpected < 0
        ? "overdue"
        : daysToExpected <= 30
          ? "in30"
          : daysToExpected <= 60
            ? "in60"
            : daysToExpected <= 90
              ? "in90"
              : "later";
    buckets[bucket].count += 1;
    buckets[bucket].expectedAmount += openAmt;

    // rawAmount-Bucket separat (ohne Adjustment)
    const rawBucket: LiquidityBucket["key"] =
      daysToDue < 0
        ? "overdue"
        : daysToDue <= 30
          ? "in30"
          : daysToDue <= 60
            ? "in60"
            : daysToDue <= 90
              ? "in90"
              : "later";
    buckets[rawBucket].rawAmount += openAmt;
  }

  // Reihenfolge stabilisieren
  const orderedBuckets: LiquidityBucket[] = [
    buckets.overdue,
    buckets.in30,
    buckets.in60,
    buckets.in90,
    buckets.later,
    buckets.noduedate,
  ];

  return {
    generatedAt: now.toISOString(),
    meanDelayDays: Math.round(meanDelayDays * 10) / 10,
    medianDelayDays,
    sampleSize: delays.length,
    totalOpenAmount,
    totalOpenCount,
    buckets: orderedBuckets,
  };
}
