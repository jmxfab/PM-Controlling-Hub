# n8n – Microsoft-Mail-Ingest

Liest ungelesene Mails aus Microsoft Outlook (delegierter OAuth-Login) und
schickt sie an den Controlling Hub. Dort werden sie dedupliziert,
klassifiziert (Claude) und in `emails_processed` gespeichert – und erscheinen
automatisch in der Aufgaben-/Mail-Ansicht.

```
[Schedule alle 5 Min] → [Outlook: ungelesene Mails] → [POST /api/emails/ingest] → [optional: als gelesen markieren]
```

## 1. Microsoft (Azure / Entra) – App registrieren

App-Registrierungen: https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

1. **Neue Registrierung** → Name `n8n Mail Jumax`, Single Tenant.
2. **Redirect-URI** (Plattform „Web"):
   `https://<DEINE-N8N-DOMAIN>/rest/oauth2-credential/callback`
3. Übersicht: **Client-ID** + **Mandanten-(Tenant-)ID** kopieren.
4. **Zertifikate & Geheimnisse** → neues Client-Secret → **Wert** kopieren.
5. **API-Berechtigungen** → Microsoft Graph → *Delegiert*:
   `Mail.Read`, `offline_access`, `openid`, `User.Read`
   (für „als gelesen markieren" zusätzlich `Mail.ReadWrite`).

## 2. n8n – Workflow importieren

1. n8n öffnen → **Workflows → Import from File** → `jumax-mail-ingest.workflow.json`.
2. Credential **Microsoft Outlook OAuth2 API** anlegen (Client-ID + Secret aus Schritt 1),
   per „Sign in with Microsoft" einloggen. Beiden Outlook-Knoten zuweisen.
3. Platzhalter im HTTP-Knoten ersetzen:
   - `PLACEHOLDER_APP_DOMAIN` → deine App-Domain (z.B. Vercel-URL)
   - `PLACEHOLDER_INGEST_SECRET` → derselbe Wert wie `INGEST_SECRET` in der App
4. Workflow aktivieren.

## 3. App (Vercel) – Secret hinterlegen

Environment-Variable `INGEST_SECRET` setzen (gleicher Wert wie im n8n-HTTP-Knoten).
Erzeugen z.B. mit `openssl rand -hex 32`.
