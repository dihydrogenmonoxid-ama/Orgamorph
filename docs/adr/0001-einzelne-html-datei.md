# 0001 Eine HTML-Datei, esbuild, inline IIFE, CSP-Hash

Status: freigegeben (E2, E3)

## Kontext
Orgamorph wird per Doppelklick unter `file://` geöffnet. Module-Skripte mit `src` und `fetch()` auf lokale Dateien funktionieren dort nicht.

## Entscheidung
- esbuild bündelt `src/main.tsx` als **IIFE** (`format: "iife"`, JSX automatisch mit `jsxImportSource: "preact"`).
- `scripts/build.mjs` liest `src/index.html`, setzt CSS (`tokens`, `base`, `app`, `print`) und Skript inline ein und berechnet den **SHA-256 des Skriptinhalts** für `script-src`.
- `</script` und `<!--` im Bundle werden maskiert, damit der Inhalt das `<script>`-Element nicht vorzeitig beendet. Der Hash wird über den maskierten Text berechnet.
- Version und Build-Datum kommen per `define` (`__VERSION__`, `__BUILD_DATE__`) und als `<meta name="generator">` in die Datei.
- Größenwarnung ab 400 kB.

## Konsequenzen
- Keine Abhängigkeit von einem Server. Beispiele, Übersetzungen und Icons werden importiert.
- `npm run watch` baut bei Änderungen neu. CSS-Dateien werden mitbeobachtet.
- Ein Playwright-Smoke-Test öffnet `dist/orgamorph.html` unter `file://` in Chromium und Firefox und prüft: keine Requests, keine Konsolenfehler (also auch keine CSP-Verletzung).
