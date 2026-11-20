# 0004 Speichern unter `file://`

Status: vorgeschlagen (E7). Phase-0-Ergebnis.

## Messung (Playwright, headless, persistentes Profil, 2026-11-17)

| Engine | `isSecureContext` | `origin` | `showSaveFilePicker` | localStorage | IndexedDB | nach Neustart erhalten |
|---|---|---|---|---|---|---|
| Chromium 159 | ja | `file://` | vorhanden | ja | ja | ja (beide) |
| Firefox (Playwright) | ja | `null` | fehlt | ja | ja | ja (beide) |
| WebKit 27.2 | ja | `file://` | fehlt | ja | ja | ja (beide) |

`navigator.storage.persisted()` ist überall `false`: der Browser darf den Speicher bei Platzmangel räumen.

## Entscheidung
- **Datei-Modus**, wenn `showSaveFilePicker` vorhanden ist (Chrome, Edge). Datei-Handle in IndexedDB (`orgamorph` / `handles`), beim Start „Zuletzt geöffnet“. Rechte werden beim Wiederöffnen per `requestPermission({mode:"readwrite"})` auf Nutzeraktion angefragt.
- **Browser-Modus** sonst: Autosave in IndexedDB, Fallback localStorage. Schlüssel immer `doc:<Dokument-ID>` (§5.1). Dauerhafte Anzeige „Nur im Browser gespeichert“ und Knopf „Als Datei sichern“.
- `navigator.storage.persist()` wird im Browser-Modus einmal angefragt (best effort).

## Manuell zu prüfen (nicht headless automatisierbar)
- [ ] Chrome und Edge: echter Speichern-Dialog unter `file://`, Schreiben, Handle nach Neustart, Rechteabfrage.
- [ ] Safari (echt, nicht WebKit-Playwright): Speicher nach Neustart erhalten. Safari räumt Skriptspeicher nach 7 Tagen ohne Nutzung (ITP); deshalb ist „Als Datei sichern“ dort wichtig.
- [ ] Firefox: `origin` ist `null`. Laut Messung bleibt der Speicher trotzdem erhalten; bei `privacy.file_unique_origin` hat jede Datei ihren eigenen Speicher.
