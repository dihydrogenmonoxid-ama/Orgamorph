# Dateiformat `*.orgamorph.json`

Deutsch · [English](file-format.en.md)

Orgamorph speichert ein Dokument als JSON-Datei mit der Endung `.orgamorph.json`. Das Schema liegt in [`schema/orgamorph.schema.json`](../schema/orgamorph.schema.json). Diese Seite beschreibt Aufbau und Regeln.

## Grundsätze

- **UTF-8**, 2 Leerzeichen Einrückung, Zeilenumbruch `\n` am Dateiende.
- **Feste Schlüsselreihenfolge** wie unten aufgeführt. Gleiche Daten ergeben byte-gleiche Dateien, Änderungen erzeugen kleine Diffs.
- **Leere optionale Felder entfallen** (leere Zeichenketten, leere Objekte).
- **Unbekannte Felder bleiben erhalten.** Sie stehen hinter den bekannten Feldern. Andere Werkzeuge können so eigene Angaben ergänzen.
- **`schemaVersion`** ist unabhängig von der Programmversion. Eine Datei mit höherer Version öffnet Orgamorph nur lesend und zeigt einen Hinweis.
- Datumsangaben im Format `JJJJ-MM-TT`, Zeitstempel in `meta` als ISO 8601 (UTC).

## Aufbau

```json
{
  "format": "orgamorph",
  "schemaVersion": 1,
  "id": "d_k3f9a1x2qp",
  "meta": { "title": "Stadtverwaltung Musterstadt", "organization": "…", "department": "…", "author": "…", "asOf": "2026-11-01", "created": "…", "modified": "…", "logo": "data:image/png;base64,…" },
  "units": [ … ],
  "topics": [ … ],
  "relations": [ … ],
  "settings": { "levelNames": ["Behördenleitung", "Abteilung", "Referat", "Sachgebiet"], "spanOfControlHint": 7 },
  "view": { … }
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `format` | ja | immer `"orgamorph"` |
| `schemaVersion` | ja | derzeit `1` |
| `id` | nein | Dokument-ID (`d_` + 10 Zeichen). Schlüssel für den Browser-Speicher. Fehlt sie, wird beim Laden eine erzeugt ([ADR 0010](adr/0010-dokument-id.md)). |
| `meta` | ja | Titel, Organisation, Stand, Zeitstempel; für den Plankopf optional `department` (Organisationseinheit), `author` (Ersteller) und `logo` (data:-URL, PNG/JPEG/WebP/SVG, ≤ 400 000 Zeichen, [ADR 0014](adr/0014-plankopf-und-xlsx.md)) |
| `units` | ja | Organisationseinheiten. **Array-Reihenfolge = Geschwisterreihenfolge.** Orgamorph schreibt sie in Tiefensuche-Reihenfolge (Eltern vor Kindern). |
| `topics` | nein | Projekte & Themen |
| `relations` | nein | Beziehungen zusätzlich zur Linie |
| `settings` | nein | Ebenenbezeichnungen, Hinweisgrenze Leitungsspanne |
| `view` | nein | Darstellung (Sicht, Filter, Beschriftung). Gehört nicht zur Analyse. |

### Organisationseinheit (`units[]`)

```json
{
  "id": "u_k3f9a1x2qp",
  "parentId": "u_root000001",
  "name": "Abteilung 1",
  "shortName": "Abt 1",
  "type": "Abteilung",
  "responsibilities": "Aufgabenbereich 1",
  "isStaff": false,
  "lead": { "title": "Abteilungsleitung", "code": "A1", "positionNumber": "01.100", "holder": "Max Mustermann" },
  "note": "…"
}
```

Pflicht sind `id`, `parentId` (bei der Wurzel `null`) und `name`. `lead.holder` (Besetzung) ist ein personenbezogenes Datum. Es ist optional und erscheint in keiner Ausgabe, solange es nicht ausdrücklich eingeschaltet ist.

### Projekt / Thema (`topics[]`)

| Feld | Werte |
|---|---|
| `type` | `project` · `workingGroup` · `committee` · `crossCutting` · `other` |
| `period` | `{ "from": "2026-01-01", "to": "2026-12-31" }`, ohne `to` dauerhaft bzw. offen |
| `participants` | `[{ "unitId": "u_…", "role": "lead" \| "member" }]`, je Einheit höchstens ein Eintrag |
| `color` | Hex-Farbe, Standard aus der Okabe-Ito-Palette |

### Beziehung (`relations[]`)

`{ "id": "r_…", "from": "u_…", "to": "u_…", "kind": "reportsTo" | "directs" | "informs" | "coordinates", "note": "…" }`

`coordinates` ist beidseitig, die anderen Arten sind gerichtet.

## Invarianten

Beim Öffnen prüft Orgamorph:

- genau eine Wurzel, keine Zyklen, jede `parentId` existiert
- jede `unitId`, `from` und `to` existiert, je Projekt höchstens ein Eintrag pro Einheit
- `period.from ≤ period.to`, gültige Datumsangaben
- IDs sind über alle Objektarten eindeutig

Doppelte Stellennummern und Leitungsspannen über dem Hinweiswert sind **Hinweise**, keine Fehler.

## IDs

`<Präfix>_<10 Zeichen a–z, 0–9>`, Präfix `u` (Einheit), `t` (Projekt/Thema), `r` (Beziehung), `d` (Dokument). Erzeugt mit `crypto.getRandomValues`.

## Änderungen am Format

Jede Änderung braucht eine neue `schemaVersion`, eine Migration in `src/core/migrate.ts`, Tests, ein aktualisiertes Schema und diese Dokumentation.

## Tabellen-Import (CSV und Excel)

Einheiten lassen sich aus CSV oder XLSX übernehmen. Die Vorlage [`examples/vorlage-struktur.xlsx`](../examples/vorlage-struktur.xlsx) enthält ein Blatt „Beispiel“ und ein Blatt „Blanko“; [`examples/beispiel-einheiten.csv`](../examples/beispiel-einheiten.csv) zeigt dasselbe als CSV.

| Spalte (deutsch) | Spalte (englisch) | Bedeutung |
|---|---|---|
| ID | id | beliebige Kennung, nur für Bezüge innerhalb der Tabelle |
| Übergeordnet | parentId | ID oder Kürzel der übergeordneten Einheit; leer = oberste Ebene |
| Bezeichnung | name | Pflicht |
| Kürzel | shortName | |
| Typ | type | z. B. Abteilung, Referat |
| Funktion | leadTitle | z. B. Abteilungsleitung |
| Funktionskürzel | leadCode | |
| Stellennummer | positionNumber | |
| Besetzung | holder | Name, personenbezogen |
| Aufgabenbereich | responsibilities | |
| Stabsstelle | isStaff | „x“, „ja“ oder „1“ |
| Notiz | note | |
