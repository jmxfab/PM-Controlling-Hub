import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cleanProjectName } from "@/lib/hero/project-title";

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
  /** Top 10 offene Rechnungen nach openAmount sortiert — fuer Detail-Liste im UI. */
  topOpen: TopOpenInvoice[];
}

export interface TopOpenInvoice {
  id: string;
  /** Project_match_id — fuer Cross-Link ins Logbuch / Detail-Drill-Down. */
  projectMatchId: string | null;
  nr: string | null;
  customerName: string | null;
  projectNumber: string | null;
  projectName: string | null;
  documentDate: string | null;
  dueDate: string | null;
  openAmount: number;
  daysOverdue: number | null;
  /** Letzter Logbuch-Eintrag des Projekts der zahlungsrelevant aussieht
   *  (Keywords: bezahlt, rechnung, mahn, geklärt, storno, gutschrift, …).
   *  NULL wenn nichts gefunden — dann ist die Rechnung im Logbuch nicht
   *  in den letzten 90 Tagen erwaehnt worden. */
  recentNote: RecentNote | null;
}

export interface RecentNote {
  date: string;
  author: string | null;
  /** Kompakter Snippet, max ~140 Zeichen, HTML-Tags entfernt. */
  snippet: string;
  /** Klassifikation aus dem Snippet:
   *   - 'paid' = "bezahlt" / "geklärt" / "ausgeglichen" → vermutlich erledigt
   *   - 'dunning' = "mahn" / "erinnerung" / "letzte mahnung" → laeuft schon
   *   - 'other' = generischer Treffer, manuell pruefen */
  kind: "paid" | "dunning" | "other";
}

type InvoiceRow = {
  id: string;
  nr: string | null;
  document_date: string | null;
  value: number | string | null;
  booking_balance: number | string | null;
  booking_due_date: string | null;
  booking_paid_date: string | null;
  booking_is_open: boolean | null;
  project_match_id: string | null;
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

  // 1) Offene Rechnungen — OHNE raw JSONB (Performance: spart MB-Payload
  //    bei 10k Zeilen, raw brauchen wir nur fuer die Top-10).
  const { data: openRowsData, error: openErr } = await supabase
    .from("hero_customer_documents")
    .select(
      "id, nr, document_date, value, booking_balance, booking_due_date, booking_paid_date, booking_is_open, project_match_id",
    )
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .eq("booking_is_open", true)
    .limit(10_000);
  if (openErr) throw openErr;
  const openRows: InvoiceRow[] = (openRowsData ?? []) as InvoiceRow[];

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

  // Top-10 offene Rechnungen — fuer Detail-Liste im Panel.
  // Schritt 1: Vor-Sortieren nach openAmount, top 10 picken (damit nur
  // 10 Projekte resolved werden muessen, nicht alle).
  const rankedOpen = openRows
    .map((r) => ({
      row: r,
      openAmt: toNum(r.booking_balance) ?? toNum(r.value) ?? 0,
    }))
    .filter((x) => x.openAmt > 0)
    .sort((a, b) => b.openAmt - a.openAmt)
    .slice(0, 10);

  // Schritt 1b: raw-JSONB NUR fuer die Top-10 nachladen (Fallback fuer
  // Customer-Name wenn hero_dashboard_projects.customer_name fehlt).
  const topIds = rankedOpen.map((x) => x.row.id);
  let rawById: Record<
    string,
    { Customer?: { Name?: string }; CustomerName?: string } | null
  > = {};
  if (topIds.length > 0) {
    const { data: rawData } = await supabase
      .from("hero_customer_documents")
      .select("id, raw")
      .in("id", topIds)
      .limit(topIds.length);
    if (Array.isArray(rawData)) {
      rawById = Object.fromEntries(
        rawData.map((r: { id: string; raw: unknown }) => [
          r.id,
          (r.raw as { Customer?: { Name?: string }; CustomerName?: string }) ??
            null,
        ]),
      );
    }
  }

  // Schritt 2: Batch-Resolve project_match_id -> Projekt-Daten (Number/Name/Kunde).
  // hero_dashboard_projects ist die richtige Tabelle weil sie customer_name
  // direkt mitliefert (im Gegensatz zu hero_projects).
  const projectIds = rankedOpen
    .map((x) => x.row.project_match_id)
    .filter((id): id is string => Boolean(id));
  const uniqueProjectIds = Array.from(new Set(projectIds));
  let projectMap: Record<
    string,
    { number: string | null; name: string | null; customerName: string | null }
  > = {};
  if (uniqueProjectIds.length > 0) {
    const { data: projData } = await supabase
      .from("hero_dashboard_projects")
      .select("id, project_number, project_name, customer_name")
      .in("id", uniqueProjectIds)
      .limit(uniqueProjectIds.length);
    if (Array.isArray(projData)) {
      projectMap = Object.fromEntries(
        projData.map(
          (p: {
            id: string;
            project_number: string | null;
            project_name: string | null;
            customer_name: string | null;
          }) => [
            p.id,
            {
              number: p.project_number ?? null,
              name: cleanProjectName(p.project_name),
              customerName: p.customer_name ?? null,
            },
          ],
        ),
      );
    }
  }

  // Schritt 3: Batch-Logbuch-Vermerke. Hole alle Histories der Top-10-Projekte
  // der letzten 90 Tage, sortiere nach Datum DESC, picke je Projekt den
  // ersten zahlungsrelevanten Eintrag.
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  const notesByProject: Record<string, RecentNote> = {};
  if (uniqueProjectIds.length > 0) {
    const { data: histData } = await supabase
      .from("hero_histories")
      .select(
        "project_match_id, entry_date, custom_text, custom_title, description, author_name",
      )
      .in("project_match_id", uniqueProjectIds)
      .gte("entry_date", ninetyDaysAgo.toISOString())
      .eq("is_deleted", false)
      .order("entry_date", { ascending: false, nullsFirst: false })
      .limit(500);

    if (Array.isArray(histData)) {
      for (const h of histData as Array<{
        project_match_id: string | null;
        entry_date: string | null;
        custom_text: string | null;
        custom_title: string | null;
        description: string | null;
        author_name: string | null;
      }>) {
        if (!h.project_match_id || !h.entry_date) continue;
        if (notesByProject[h.project_match_id]) continue; // schon einen Treffer
        const rawText = [h.custom_title, h.custom_text, h.description]
          .filter((s): s is string => Boolean(s))
          .join(" ");
        if (!rawText) continue;
        const clean = rawText
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const lower = clean.toLowerCase();

        // Klassifikation per Keyword-Match. Reihenfolge wichtig — "bezahlt"
        // gewinnt vor "mahn" wenn beides drin steht (Tippreihenfolge).
        const isPaid = /\b(bezahlt|geklärt|geklaert|ausgeglichen|erledigt|gutschrift)\b/.test(
          lower,
        );
        const isDunning = /\b(mahn|erinnerung|letzte mahnung|inkasso|rsa|verzug)\b/.test(
          lower,
        );
        const isInvoiceMention = /\b(rechnung|zahlung|teilrechnung|storno|teilzahlung)\b/.test(
          lower,
        );
        if (!isPaid && !isDunning && !isInvoiceMention) continue;

        const kind: RecentNote["kind"] = isPaid
          ? "paid"
          : isDunning
            ? "dunning"
            : "other";
        const snippet =
          clean.length > 140 ? clean.slice(0, 137) + "…" : clean;
        notesByProject[h.project_match_id] = {
          date: h.entry_date,
          author: h.author_name ?? null,
          snippet,
          kind,
        };
      }
    }
  }

  // Schritt 4: TopOpenInvoice Objekte bauen
  const topOpen: TopOpenInvoice[] = rankedOpen.map((x) => {
    const r = x.row;
    const proj = r.project_match_id ? projectMap[r.project_match_id] : null;
    // Customer-Name: hero_dashboard_projects.customer_name als primary,
    // raw.Customer.Name als Fallback (nur fuer Top-10 nachgeladen).
    const rawAny = rawById[r.id] ?? null;
    const customerName =
      proj?.customerName ??
      rawAny?.Customer?.Name ??
      rawAny?.CustomerName ??
      null;

    let daysOverdue: number | null = null;
    if (r.booking_due_date) {
      const due = new Date(r.booking_due_date);
      if (!Number.isNaN(due.getTime())) {
        const d = daysBetween(today, due);
        daysOverdue = d > 0 ? d : 0;
      }
    }

    const recentNote = r.project_match_id
      ? (notesByProject[r.project_match_id] ?? null)
      : null;

    return {
      id: r.id,
      projectMatchId: r.project_match_id,
      nr: r.nr,
      customerName,
      projectNumber: proj?.number ?? null,
      projectName: proj?.name ?? null,
      documentDate: r.document_date,
      dueDate: r.booking_due_date,
      openAmount: x.openAmt,
      daysOverdue,
      recentNote,
    } satisfies TopOpenInvoice;
  });

  return {
    generatedAt: now.toISOString(),
    meanDelayDays: Math.round(meanDelayDays * 10) / 10,
    medianDelayDays,
    sampleSize: delays.length,
    totalOpenAmount,
    totalOpenCount,
    buckets: orderedBuckets,
    topOpen,
  };
}
