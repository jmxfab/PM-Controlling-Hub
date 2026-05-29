// Klont WP-Projekte (Wärmepumpen, type_id 36934) aus Source-Hero ins
// Target-Hero. Standardmaessig DRY-RUN — keine Mutations, nur Plan-
// Output. Mit --commit werden create_contact + create_project_match
// abgesetzt.
//
// Aufruf:
//   node --env-file=.env.local scripts/hero-clone-projects.mjs --limit=50
//   node --env-file=.env.local scripts/hero-clone-projects.mjs --limit=50 --commit
//
// Env vars (in .env.local):
//   HERO_API_KEY         → Source (Quelle, schon gesetzt)
//   HERO_API_KEY_TARGET  → Ziel (neuer Tenant)

const ENDPOINT = "https://login.hero-software.de/api/external/v7/graphql";

// Wärmepumpe = type_id "36934" laut HERO_TYPE_ID_TO_DEPARTMENT
const WP_TYPE_ID = 36934;

const args = process.argv.slice(2);
const limit = Number(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "50"
);
const commit = args.includes("--commit");

const sourceKey = process.env.HERO_API_KEY;
const targetKey = process.env.HERO_API_KEY_TARGET;
if (!sourceKey) {
  console.error("HERO_API_KEY (Source) fehlt in .env.local");
  process.exit(1);
}
if (!targetKey) {
  console.error(
    "HERO_API_KEY_TARGET fehlt in .env.local — bitte eintragen:\n" +
      "  HERO_API_KEY_TARGET=ac_..."
  );
  process.exit(1);
}

async function gql(apiKey, query, variables) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) {
    throw new Error(
      "GraphQL errors: " + j.errors.map((e) => e.message).join(", ")
    );
  }
  return j.data;
}

// ----- 1. Quelle: WP-Projekte mit Kunden + aktuellem Step -----------------

const SOURCE_QUERY = `
  query SourceWPProjects($first: Int!, $type_ids: [Int!]) {
    project_matches(first: $first, type_ids: $type_ids, orderBy: "id") {
      id
      project_nr
      project_title
      project_type
      type_id
      partner_source
      partner_notes
      volume
      created
      modified
      measure { id name short }
      customer {
        id
        first_name
        last_name
        company_name
        email
        phone_home
        phone_mobile
      }
      contact {
        id
        first_name
        last_name
        company_name
        email
        phone_home
        phone_mobile
      }
      address {
        street
        zipcode
        city
      }
      current_project_match_status {
        id
        status_code
        name
        short_name
        maturity_date
        step { id name }
      }
    }
  }
`;

console.log(`Lade ${limit} Wärmepumpen-Projekte aus der Quelle…`);
const sourceData = await gql(sourceKey, SOURCE_QUERY, {
  first: limit,
  type_ids: [WP_TYPE_ID],
});
const projects = sourceData?.project_matches ?? [];
console.log(`→ ${projects.length} Projekte gefunden.\n`);

if (projects.length === 0) {
  console.log("Nichts zu tun.");
  process.exit(0);
}

// ----- 2. Plan ausgeben ----------------------------------------------------

console.log("=".repeat(80));
console.log(`PLAN — würde ${projects.length} WP-Projekte ins Ziel kopieren:`);
console.log("=".repeat(80));
for (const p of projects.slice(0, 10)) {
  const cust =
    p.customer?.company_name ||
    [p.customer?.first_name, p.customer?.last_name].filter(Boolean).join(" ") ||
    "(kein Kunde)";
  const step = p.current_project_match_status?.step?.name ?? "—";
  console.log(
    `  ${(p.project_nr ?? "—").padEnd(12)} ${cust.padEnd(35)} step="${step}"`
  );
}
if (projects.length > 10) {
  console.log(`  … (+ ${projects.length - 10} weitere)\n`);
} else {
  console.log("");
}

if (!commit) {
  console.log("DRY-RUN — keine Mutations gegen das Target-Hero.");
  console.log("Mit --commit nochmal aufrufen um wirklich zu uebertragen.");
  process.exit(0);
}

// ----- 3. Commit-Run: create_contact + create_project_match ---------------

console.log("=".repeat(80));
console.log("COMMIT — schreibe ins Target-Hero…");
console.log("=".repeat(80));

const CREATE_CONTACT = `
  mutation CreateContact($findExisting: Boolean, $contact: CustomerInput!) {
    create_contact(findExisting: $findExisting, contact: $contact) {
      id
      first_name
      last_name
      company_name
    }
  }
`;

const CREATE_PROJECT_MATCH = `
  mutation CreateProjectMatch($pm: ProjectMatchInput!) {
    create_project_match(project_match: $pm) {
      id
      project_nr
      project_title
    }
  }
`;

const results = [];
for (const [i, p] of projects.entries()) {
  const label = `[${i + 1}/${projects.length}] ${p.project_nr ?? p.id}`;
  try {
    // Schritt A: Customer im Ziel anlegen (oder finden via findExisting=true)
    const c = p.customer ?? p.contact ?? null;
    let targetCustomerId = null;
    if (c) {
      const created = await gql(targetKey, CREATE_CONTACT, {
        findExisting: true,
        contact: {
          first_name: c.first_name ?? null,
          last_name: c.last_name ?? null,
          company_name: c.company_name ?? null,
          email: c.email ?? null,
          phone_home: c.phone_home ?? null,
          phone_mobile: c.phone_mobile ?? null,
        },
      });
      targetCustomerId = created?.create_contact?.id ?? null;
    }

    // Schritt B: ProjectMatch im Ziel anlegen
    const pmInput = {
      project_type: p.project_type ?? null,
      type_id: p.type_id ?? WP_TYPE_ID,
      project_nr: p.project_nr ?? null,
      project_title: p.project_title ?? null,
      partner_source: p.partner_source ?? null,
      partner_notes: p.partner_notes ?? null,
      volume: p.volume ?? null,
      customer_id: targetCustomerId,
      measure_id: p.measure?.id ?? null,
    };
    const created = await gql(targetKey, CREATE_PROJECT_MATCH, {
      pm: pmInput,
    });
    const newId = created?.create_project_match?.id;
    console.log(`${label} → angelegt als id=${newId}`);
    results.push({ src: p.id, srcNr: p.project_nr, target: newId, ok: true });
  } catch (err) {
    console.error(`${label} FEHLER: ${err.message}`);
    results.push({
      src: p.id,
      srcNr: p.project_nr,
      ok: false,
      error: err.message,
    });
  }
}

const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.log("\n" + "=".repeat(80));
console.log(`Fertig: ${ok}/${results.length} angelegt, ${fail} Fehler.`);
console.log("=".repeat(80));
