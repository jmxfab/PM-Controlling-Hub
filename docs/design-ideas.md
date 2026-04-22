# Design-Überarbeitung — Ideen & Optionen

## Analyse des aktuellen Designs

**Was gut funktioniert:**
- Amber/Orange Gradient-Border oben in der Nav — starkes Markenelement, beibehalten
- Dark Mode Basis-Palette (dunkel-blau `#161b27`) — gute Grundlage
- Farbige KPI-Zahlen (rot/orange/grün) für sofortige Statuserkennung

**Identifizierte Schwachstellen:**

| # | Problem | Betroffene Seiten |
|---|---|---|
| 1 | Weißes Nav-Pill wirkt auf dunkler Nav aufgeklebt | Alle |
| 2 | KPI-Cards ohne visuelle Hierarchie — alle identisch, kritische Werte springen nicht ins Auge | Insights, Controlling |
| 3 | Technischer Subtitel sichtbar — `current_project_match_status.maturity_date` | Fälligkeiten |
| 4 | Sparte-Badges als Plain Text ohne Farbe (WP, PV) | Fälligkeiten-Tabelle |
| 5 | Department-Tabs: aktiver Zustand zu schwach, visuell wenig Gewicht | Alle |

---

## Option A — Quick Polish (~2h)

**Idee:** Nur die auffälligsten Schwachstellen beheben, ohne das bestehende Design-System anzutasten.

**Änderungen:**
- Nav Active-State: Weißes Pill → **Amber Underline** (2px `#f59e0b` am unteren Rand des Nav-Items)
- Zeitfenster-Pills: Aktiv → amber-getönter Hintergrund `rgba(245,158,11,0.15)` + amber Text
- Department-Tabs Aktiv: Amber Underline statt schwacher Hintergrund
- KPI-Cards: **Left-Border** (3px) in Signalfarbe bei Warn (`#f59e0b`) und Danger (`#ef4444`) Cards
- Sparte-Badges: Farbige Pill-Badges (WP → lila, PV → amber, Klima → cyan)
- Subtitel auf Fälligkeiten-Seite: DB-Feldname entfernen, menschenlesbar formulieren

---

## Option B — Amber Brand Identity (~1 Tag)

**Idee:** Amber als echte Primärfarbe konsequent durch die gesamte App durchziehen. Passt zu Jumax (Energie, PV, Elektro).

**Änderungen zusätzlich zu Option A:**
- Nav Active-State: **Amber-Pill** mit dunklem Amber-Hintergrund `rgba(245,158,11,0.15)` + Amber-Border
- Alle aktiven Zustände (Pills, Tabs) nutzen Amber als einheitliche Primärfarbe
- KPI-Cards: Subtle **Colored Border + Inner Glow** statt nur Left-Border
- Border Radius auf `0.75rem` (10px) — etwas weicher, moderner
- Einheitliche Schattenhierarchie auf Cards (`box-shadow: 0 1px 3px rgba(0,0,0,0.3)`)
- `--primary` CSS-Variable auf Amber umstellen statt neutrales Dunkelgrau
- Sparte-Badges: Farbig (wie Option A)
- Subtitel bereinigen (wie Option A)

---

## Option C — System Redesign (~3 Tage)

**Idee:** Neue Navigationsstruktur + Blau als Primärfarbe. Klassisches SaaS-Dashboard-Muster.

**Änderungen:**
- Navigation: Top-Nav → **Linke Sidebar** (200px) mit Text + Icon
- Primärfarbe: Blau `#3b82f6` statt Amber (moderneres SaaS-Feel)
- KPI-Cards: **Top Accent Bar** (2px) in Signalfarbe statt Left-Border
- Dunklerer Background: `#0d1117` (GitHub-ähnlich, echter Dark Mode)
- Department-Tabs aktiv: Blauer Hintergrund + Border
- Alle aktiven Zustände in Blau
- Sparte-Badges: Farbig (wie Option A)
- Subtitel bereinigen (wie Option A)

---

## Empfehlung

**Option B** — Amber Brand Identity ist der beste Kompromiss:
- Amber passt zu Jumax (PV, Energie, Elektrotechnik) semantisch besser als Blau
- Behält die bewährte Top-Navigation (kein strukturelles Risiko)
- Deutlich spürbare visuelle Verbesserung mit überschaubarem Aufwand
- Der bestehende Amber-Gradient-Border oben in der Nav wird zum konsistenten System

---

*Erstellt: 2026-04-22*
*Design-Preview HTML: `design-preview.html` (Projektroot, nicht committen)*
