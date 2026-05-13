import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface HeroCommentItem {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean | null;
  category: string | null;
  notification_date: string | null;
  target_id: string | null;
  project_number: string | null;
  project_name: string | null;
  /** true wenn Domenic in Titel/Body genannt oder ihm zugewiesen wurde */
  is_for_domenic: boolean;
}

/**
 * Bestimmt ob eine Hero-Notification fuer Domenic eine AUFGABE ist
 * (echte Erwaehnung mit Handlungserwartung).
 *
 * NICHT als Aufgabe zaehlen:
 * - "Ihnen wurde das Projekt zugewiesen" -> reine Status-Info, kein To-Do
 *   (Hero-Zuweisungen sind Buchhalter-Workflow, keine Arbeitsaufforderung)
 */
function isForDomenic(title: string | null, body: string | null): boolean {
  const txt = `${title ?? ""} ${body ?? ""}`.toLowerCase();
  // Mention-Trigger: nur direkte Nennung im Kommentar
  return (
    txt.includes("@d.wagenleitner") ||
    txt.includes("@domenic") ||
    // Frei stehender Name (Vor- oder Nachname) zaehlt als Erwaehnung,
    // aber nur ausserhalb der Zuweisungs-Phrase
    ((txt.includes("domenic") || txt.includes("wagenleitner")) &&
      !txt.includes("zugewiesen") &&
      !txt.includes("zuweisung"))
  );
}

/**
 * Laedt Hero-Notifications die in Aufgaben (Domenic erwaehnt/zugewiesen)
 * oder Infos (alles andere) gehoeren.
 */
export async function loadHeroComments(
  tab: "aufgaben" | "infos",
  limit = 200,
): Promise<HeroCommentItem[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("hero_notifications")
    .select("id, title, body, is_read, category, notification_date, target_id")
    .eq("is_deleted", false)
    .order("notification_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // Filter nach Tab-Logik:
  // aufgaben: Domenic erwaehnt
  // infos: alles andere (Hero-Kommentare die nicht Domenic betreffen)
  const filtered = rows.filter((r) => {
    const forD = isForDomenic(r.title, r.body);
    return tab === "aufgaben" ? forD : !forD;
  });

  // Project-Lookup
  const projectIds = [...new Set(filtered.map((e) => e.target_id).filter(Boolean) as string[])];
  const projectMap: Record<string, { project_number: string | null; project_name: string | null }> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("hero_projects")
      .select("id, project_number, project_name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMap[p.id] = { project_number: p.project_number ?? null, project_name: p.project_name ?? null };
    }
  }

  // Read-Override Lookup: pruefen welche Hero-IDs lokal als gelesen markiert wurden
  const heroIds = filtered.map((e) => e.id);
  const overrideSet = new Set<string>();
  if (heroIds.length > 0) {
    const { data: overrides } = await supabase
      .from("hero_read_overrides")
      .select("hero_id")
      .in("hero_id", heroIds);
    for (const o of overrides ?? []) {
      overrideSet.add(o.hero_id);
    }
  }

  return filtered.map((e) => {
    const heroReadFlag = e.is_read === true;
    const localOverride = overrideSet.has(e.id);
    return {
      id: e.id,
      title: e.title ?? null,
      body: e.body ?? null,
      // is_read = entweder Hero hat's selbst gelesen ODER lokal markiert
      is_read: heroReadFlag || localOverride,
      category: e.category ?? null,
      notification_date: e.notification_date ?? null,
      target_id: e.target_id ?? null,
      project_number: projectMap[e.target_id ?? ""]?.project_number ?? null,
      project_name: projectMap[e.target_id ?? ""]?.project_name ?? null,
      is_for_domenic: isForDomenic(e.title, e.body),
    };
  });
}

export async function countHeroComments(
  tab: "aufgaben" | "infos",
  onlyUnread = true,
): Promise<number> {
  const items = await loadHeroComments(tab, 1000);
  if (onlyUnread) return items.filter((i) => i.is_read !== true).length;
  return items.length;
}
