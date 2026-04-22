/**
 * Hero customer_documents → public.hero_customer_documents
 *
 * Separate entity rather than nested inside project_matches — this is the
 * query that triggered Hero's "Internal server error" when combined with
 * project_match_statuses in one big aggregate.
 */

import type { HeroEntitySync } from "../sync-engine";

interface CustomerDocumentRaw {
  id: string | number;
  project_match_id?: string | number | null;
  customer_id?: string | number | null;
  partner_id?: string | number | null;
  nr?: string | null;
  type?: string | null;
  status_code?: string | number | null;
  status_name?: string | null;
  value?: number | string | null;
  vat?: number | string | null;
  currency?: string | null;
  created?: string | null;
  modified?: string | null;
  document_date?: string | null;
  file_upload?: { url?: string | null } | null;
  document_type?: {
    base_type?: string | null;
    name?: string | null;
  } | null;
}

interface CustomerDocumentRow {
  id: string;
  project_match_id: string | null;
  customer_id: string | null;
  partner_id: string | null;
  nr: string | null;
  type: string | null;
  document_type_name: string | null;
  document_base_type: string | null;
  status_code: number | null;
  status_name: string | null;
  value: number | null;
  vat: number | null;
  currency: string | null;
  document_date: string | null;
  raw: CustomerDocumentRaw;
  created_at_hero: string | null;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: number | string | null | undefined): number | null {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  return Math.trunc(parsed);
}

export const customerDocumentsSync: HeroEntitySync<CustomerDocumentRaw, CustomerDocumentRow> = {
  name: "customer_documents",
  table: "hero_customer_documents",
  pageSize: 200,
  concurrency: 3,
  query: /* GraphQL */ `
    query SyncCustomerDocuments($first: Int!, $offset: Int!) {
      customer_documents(first: $first, offset: $offset, orderBy: "id") {
        id
        project_match_id
        customer_id
        partner_id
        nr
        type
        status_code
        status_name
        value
        vat
        currency
        created
        modified
        document_date
        file_upload {
          url
        }
        document_type {
          base_type
          name
        }
      }
    }
  `,
  extract: (data) =>
    (data as { customer_documents?: CustomerDocumentRaw[] } | null)?.customer_documents ?? [],
  normalize: (raw) => ({
    id: String(raw.id),
    project_match_id: raw.project_match_id != null ? String(raw.project_match_id) : null,
    customer_id: raw.customer_id != null ? String(raw.customer_id) : null,
    partner_id: raw.partner_id != null ? String(raw.partner_id) : null,
    nr: raw.nr ?? null,
    type: raw.type ?? null,
    document_type_name: raw.document_type?.name ?? null,
    document_base_type: raw.document_type?.base_type ?? null,
    status_code: toInt(raw.status_code),
    status_name: raw.status_name ?? null,
    value: toNumber(raw.value),
    vat: toNumber(raw.vat),
    currency: raw.currency ?? null,
    document_date: raw.document_date ?? null,
    raw,
    created_at_hero: raw.created ?? null,
    hero_modified_at: raw.modified ?? raw.created ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
