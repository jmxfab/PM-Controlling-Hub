import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface HeizlastDocument {
  id: string;
  document_type_name: string | null;
  nr: string | null;
  file_url: string | null;
  document_date: string | null;
  status_name: string | null;
}

export interface HeizlastProject {
  id: string;
  project_number: string | null;
  project_name: string | null;
  step_name: string | null;
  customer_name: string | null;
  customer_address: string | null;
  maturity_date: string | null;
  documents: HeizlastDocument[];
}

export async function loadHeizlastProjects(): Promise<HeizlastProject[]> {
  const supabase = supabaseAdmin();

  const { data: projects, error: projErr } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, step_name, customer_name, customer_address, maturity_date")
    .ilike("step_name", "%angebotsprüfung%")
    .order("project_number");

  if (projErr) throw new Error(projErr.message);
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => String(p.id));

  const { data: docs, error: docErr } = await supabase
    .from("hero_customer_documents")
    .select("id, document_type_name, nr, document_date, status_name, raw, project_match_id")
    .in("project_match_id", projectIds)
    .eq("is_deleted", false)
    .order("document_type_name");

  if (docErr) throw new Error(docErr.message);

  const docsByProject: Record<string, HeizlastDocument[]> = {};
  for (const doc of docs ?? []) {
    const pid = String(doc.project_match_id);
    if (!docsByProject[pid]) docsByProject[pid] = [];
    const raw = doc.raw as Record<string, unknown> | null;
    const fileUpload = raw?.file_upload as Record<string, unknown> | null;
    docsByProject[pid].push({
      id: String(doc.id),
      document_type_name: doc.document_type_name ?? null,
      nr: doc.nr ?? null,
      file_url: (fileUpload?.url as string) ?? null,
      document_date: doc.document_date ?? null,
      status_name: doc.status_name ?? null,
    });
  }

  return projects.map((p) => ({
    id: String(p.id),
    project_number: p.project_number ?? null,
    project_name: p.project_name ?? null,
    step_name: p.step_name ?? null,
    customer_name: p.customer_name ?? null,
    customer_address: p.customer_address ?? null,
    maturity_date: p.maturity_date ?? null,
    documents: docsByProject[String(p.id)] ?? [],
  }));
}
