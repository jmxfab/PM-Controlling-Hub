# Hero-API Integration Guide

**Was kann unser Controlling-Hub mit der Hero-API machen, und wie?**

Konsolidiert aus 3 Quellen (Stand 19.5.2026):

- `docs/hero-api-schema.md` (vollständiges Schema, 3052 Zeilen)
- `~/Downloads/HERO_API_Schema.md` (jumax-one Mirror-Schema)
- `Schobro Dash/hero-api-doku.md` (Live-Introspection mit Praxisbeispielen)

Diese Doku ist **projekt-spezifisch** — was wir für die geblockten Features brauchen, mit fertigen Code-Snippets.

---

## TL;DR — was geht?

| Feature in unserer Roadmap | Hero-API-Method | Status |
|---|---|---|
| **1.2** Hero-Logbuch schreiben | `mutation add_logbook_entry` | ✅ unblockable |
| **1.4** Hero-Mails importieren | `query notifications` + `query histories` | ✅ teilweise unblockable |
| **2.4** Auto-Mail-Versand via Hero | `mutation send_mail` | ✅ unblockable (alternative zu MS Graph Mail.Send) |
| Direct-Status-Change | `mutation update_project_match` + `transition_customer_document_status` | ✅ unblockable |
| Tasks aus Hero synchronisieren | `query tasks` mit `is_done`, `project_match_id` | ✅ unblockable |
| Anhang-Indikator (Item 4 / 1.4) | `customer_documents` mit `file_upload` | ✅ unblockable |
| Termine je Monteur (Item 4.1/4.2) | `query calendar_events` mit `partner_ids` | ⚠️ Hero liefert nur "CALENDAR"-Kategorie aktuell |

---

## 1) Setup

### Endpoint + Auth

```ts
const HERO_API_URL = "https://login.hero-software.de/api/external/v7/graphql";
const HERO_API_KEY = process.env.HERO_API_KEY!; // Bearer-Token

// Standardabruf
async function hero<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(HERO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HERO_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
    // Hero antwortet i.d.R. < 5s; bei großen Pulls bis 60s, sehr selten 180s
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`Hero API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    // Wichtig: Hero gibt HTTP 200 mit partial-success — data kann da sein
    // trotz errors. Trotzdem hart werfen weil wir Logbuch-Schreiben atomar wollen.
    throw new Error(`Hero GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Hero API: empty data");
  return json.data;
}
```

### Env-Vars in Vercel

```
HERO_API_KEY = "ey..."  (vom Hero-Partner-Konto, langlebig)
```

Niemals in client-bundles. Server-only nutzen (`"server-only"` Import oben).

---

## 2) Feature 1.2 — Logbuch-Eintrag schreiben

**Use-Case:** User klickt im TaskComposer auf „Direkt ins Hero-Logbuch eintragen" (statt nur Clipboard).

### GraphQL Mutation

```graphql
mutation AddLog($pmid: Int!, $title: String!, $text: String!) {
  add_logbook_entry(
    target_project_match_id: $pmid
    custom_title: $title
    custom_text: $text
  ) {
    id
    created
  }
}
```

### TypeScript Wrapper (für unseren Controlling-Hub)

```ts
// src/lib/hero/hero-mutations.ts
import "server-only";

export async function writeHeroLogEntry(args: {
  projectMatchId: number;
  title: string;
  text: string;
}): Promise<{ id: number; created: string }> {
  const data = await hero<{ add_logbook_entry: { id: number; created: string } }>(
    `mutation AddLog($pmid: Int!, $title: String!, $text: String!) {
      add_logbook_entry(
        target_project_match_id: $pmid
        custom_title: $title
        custom_text: $text
      ) { id created }
    }`,
    {
      pmid: args.projectMatchId,
      title: args.title.slice(0, 200),
      text: args.text.slice(0, 4000),
    },
  );
  return data.add_logbook_entry;
}
```

### API-Route die der Composer aufruft

```ts
// src/app/api/mail-tasks/[id]/hero-log/route.ts
export async function POST(req, { params }) {
  const { id } = await params;
  const { body, title } = await req.json();
  // 1) Task laden -> hero_project_id rausholen
  // 2) hero_project_id ist UUID in unserer DB, aber Hero will Int.
  //    Wir speichern in hero_dashboard_projects.hero_id (= project_match.id von Hero).
  // 3) writeHeroLogEntry({ projectMatchId, title, text })
  // 4) task_notes Entry mit kind='hero-log' speichern fuer History
}
```

**TaskComposer-Anpassung:** Jetzt-grauer Button „Direkt ins Hero" wird aktiv, ersetzt den „In Hero öffnen → Clipboard-Paste"-Hack.

---

## 3) Feature 2.4 — Mail-Versand via Hero (Alternative zu MS Graph)

**Use-Case:** Auto-Mail-Worker formuliert E-Mail per KI und versendet automatisch. Hero kann das selbst — ohne Microsoft Graph `Mail.Send`-Berechtigung.

### Mutation

```graphql
mutation SendMail($to: String!, $subject: String!, $body: String!, $pmid: Int) {
  send_mail(
    target_project_match_id: $pmid
    to: $to
    subject: $subject
    body: $body
  ) { id created }
}
```

> **Genaue Argumente per Introspection prüfen** — `send_mail` ist in der API-Doku gelistet, aber das exakte Input-Schema müssen wir noch verifizieren. Sehr wahrscheinlich gibt's auch `cc`, `bcc`, `attachments`, `template_id`.

### Vorteil gegenüber MS Graph

| Aspekt | MS Graph Mail.Send | Hero send_mail |
|---|---|---|
| Berechtigung | `Mail.Send` Permission + Domenic-Admin-Approval | ✅ vorhanden via API-Key |
| Absender | dwagenleitner@jumax-elektro.de | Hero-konfigurierte Absender |
| Tracking | nur in Outlook Sent | ✅ landet auch im Hero-Projekt-Verlauf |
| Templates | manuell aus DB | ✅ kann Hero-Email-Templates nutzen |

→ Hero ist die bessere Lösung für **projekt-bezogene Outgoing-Mails**.

---

## 4) Feature 1.4 — Hero-Mails / Notifications importieren

Hero hat **2 relevante Lese-Quellen**:

### A) `notifications` — Push-Notifications

```graphql
{
  notifications(first: 100) {
    id
    type
    title
    body
    is_read
    target_id
    created
    # weitere Felder per Introspection
  }
}
```

→ Das was wir bisher als `hero_notifications` in Supabase mirrord haben.

### B) `histories` (Logbuch) — auch Eingangs-Mails landen hier wenn Hero die Mail erkannt hat

```graphql
{
  histories(first: 200) {
    id
    type_code
    target            # "ProjectMatch" | "Company" | …
    target_id
    target_project_match { id project_nr }
    custom_title
    custom_text
    user { id full_name email }
    associated_outbox_mail { id }   # gesetzt wenn es eine ausgehende Mail war
    created
  }
}
```

`associated_outbox_mail_id` = nicht-null → der History-Eintrag stammt von einer **ausgehenden Hero-Mail**. Wir können also Mail-Threads im Hero-Projekt nachverfolgen.

### Pull-Strategie für unser Controlling-Hub

- n8n-Workflow alle 15 Min: `histories` mit Filter auf `created > last_sync` ziehen
- in `hero_histories` Tabelle mirrord (haben wir schon)
- Mail-erzeugte Einträge als separater Task-Typ in `tasks` einfügen

---

## 5) Feature: Termine je Monteur (Items 4.1/4.2)

```graphql
{
  calendar_events(
    start: "2026-05-19T00:00:00Z"
    end: "2026-05-26T00:00:00Z"
    partner_ids: [12, 45, 78]   # Monteur-IDs
  ) {
    id
    start
    end
    title
    project_match { id project_nr }
    partners {
      id
      full_name
    }
  }
}
```

**Caveat aus jumax-one Schema-Mirror:** Aktuell ist `hero_termin.kategorie` immer "CALENDAR" — Hero unterscheidet aktuell NICHT zwischen „Vor-Ort-Termin", „Montage", „Nachfass". → Drill-Down nicht möglich ohne Heuristik auf den `title`-String.

**Workaround:** Regex auf `title` (z.B. `/montage/i`, `/aufmaß/i`, `/heizlast/i`).

**Partner-IDs herausfinden:** Über `company { partners { id full_name email } }` einmalig pullen + in unsere DB cachen.

---

## 6) Status-Übergänge / „Erledigt" zurück nach Hero

```graphql
mutation TransitionStatus($docId: Int!, $newCode: Int!) {
  transition_customer_document_status(
    customer_document_id: $docId
    new_status_code: $newCode
  ) { id status_code status_name }
}
```

**Für Tasks:**

```graphql
mutation MarkDone($id: Int!) {
  update_task(id: $id, is_done: true) {
    id is_done modified
  }
}
```

Wir könnten beim Erledigen einer Mail-Task in unserer App optional auch eine ggf. verknüpfte Hero-Task auf done setzen.

---

## 7) Gotchas

Aus den 3 Docs konsolidiert:

| Problem | Lösung |
|---|---|
| `type: "WÄP"` String-Filter funktioniert nicht | `measure_ids: [7040]` (numerisch) |
| Heizlastberechnung als Status filtern → 0 Treffer | Es ist ein **Step** nicht Status: `step_ids: [691233]` |
| `Customer.first_name` mit Whitespace | `.trim()` vor Anzeige |
| Step-Namen mit Emoji „🧮 Heizlastberechnung" | Filter via `step_id` statt String-Match |
| Schema-Drift: HERO ändert Felder ohne Vorwarnung | Schema-Introspection regelmäßig laufen, drift-warnen |
| Sort default ist „neueste zuerst" | Server-seitig filtern statt client-paginieren |
| Bei Errors: HTTP 200 + `errors[]` array | beide `data` und `errors` prüfen — partial success möglich |
| `delete_company_account` | ⚠️ Löscht ALLES — niemals versehentlich aufrufen |

---

## 8) Bekannte IDs (Jumax)

| Bereich | Name | ID |
|---|---|---|
| Maßnahme | Wärmepumpe (WÄP) | `7040` |
| Maßnahme | Photovoltaik (PV) | `7041` (verify) |
| Step | 🧮 Heizlastberechnung | `691233` (parent: „Vor-Ort Termin") |

**Andere IDs ermitteln:**

```graphql
# Eigene Maßnahmen
{ company { measures { id name short } } }

# Projekt-Pipeline-Typen mit Steps
{ project_types { id name project_status_steps { id name } } }

# Status-Codes durch Beispiel-Projekt
{ project_matches(first: 5) {
    current_project_match_status { status_code name step { id name } }
  }
}
```

---

## 9) Was als nächstes für unseren Controlling-Hub

**Sofort umsetzbar mit dieser API (vorausgesetzt Vercel `HERO_API_KEY` gesetzt):**

1. **Hero-Logbuch-Schreiben** im TaskComposer → neue Route `/api/mail-tasks/[id]/hero-log`
2. **Send-Mail via Hero** als Alternative zu MS Graph Mail.Send → kein Domenic-Admin-OK nötig
3. **Automatischer Mail-Worker** kann jetzt komplett autonom laufen (Send + Log + Status-Update)
4. **Termine je Monteur** auf /faelligkeiten → `partner_ids` Filter (mit Heuristik-Workaround für Kategorie)

**Noch zu klären:**

1. Setze die Hero-API in Vercel als `HERO_API_KEY` Env-Var. Falls noch nicht vorhanden, generieren in: Hero → Partner-Konto → API-Tokens
2. Verify die genauen Argumente von `send_mail` per Introspection — die Doku ist hier vage
3. Testen ob unser Service-Account die nötigen Schreib-Rechte hat (sollte als Partner-API ja, aber sicher ist sicher)

---

## 10) Referenz-Links

- Full Schema: `docs/hero-api-schema.md` (3052 Zeilen, alle Types + Fields)
- Live-Schema-JSON: `~/OneDrive/.../Schobro Dash/hero-api-schema.json` (für Code-Gen)
- jumax-one Mirror-Stand: `~/Downloads/HERO_API_Schema.md` (was im Schwester-Projekt schon gepullt wird)
- Introspection-Skript-Vorlage: siehe `Schobro Dash/hero-api-doku.md` Anhang
