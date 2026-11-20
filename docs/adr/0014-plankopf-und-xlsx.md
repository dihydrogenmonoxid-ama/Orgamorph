# 0014 Plankopf und Excel-Import ohne Abhängigkeit

Status: vorgeschlagen

## Plankopf
`meta` erhält drei optionale Felder: `department` (erstellende Organisationseinheit), `author` (Ersteller) und `logo` (Logo als `data:`-URL, PNG/JPEG/WebP/SVG, höchstens 400 000 Zeichen). Sie erscheinen im Schriftfeld der Druckseite.

- Die Erweiterung ist **additiv und optional**. Ältere Fassungen erhalten unbekannte Felder beim Speichern. Deshalb gibt es **keine neue `schemaVersion`** (wie bei der Dokument-ID, ADR 0010). Schema und Dokumentation sind ergänzt.
- Rastergrafiken werden beim Hinzufügen auf höchstens 600 × 300 px verkleinert und als PNG gespeichert. SVG-Dateien mit Skripten werden abgelehnt.
- `updateMeta` lehnt ungültige Logos ab. Beim Laden ergibt ein ungültiges Logo einen Hinweis, gedruckt wird es dann nicht.
- `author` ist ein personenbezogenes Datum. Es wird bewusst für den Plankopf erfasst und nur dort ausgegeben.

## Excel (XLSX)
Import und Vorlage arbeiten mit XLSX, ohne neue Runtime-Abhängigkeit:

- `core/io/zip.ts` schreibt ZIP-Archive unkomprimiert (deterministisch) und liest „stored“ und „deflate“. Das Entpacken übernimmt im Browser `DecompressionStream("deflate-raw")` (Chrome 103+, Firefox 113+, Safari 16.4+), in Tests `node:zlib`.
- `core/io/xlsx.ts` schreibt einfache Text-Mappen (Textformat „@“, damit „10.1“ oder „01.100“ nicht zu Zahlen werden) und liest Blätter als Zeilen (gemeinsame Zeichenketten, Inline-Text, Zahlen, Wahrheitswerte). Excel-Datumswerte (Seriennummern) erkennt der Projekt-Import.
- CSV und XLSX laufen über dieselbe Zeilenverarbeitung (`importUnitsRows`, `importTopicsRows`).
- Beim Import einer Mappe gilt das erste Blatt mit Daten, das nicht „Beispiel“ heißt; sonst das Beispielblatt.
- Die Vorlage `examples/vorlage-struktur.xlsx` (Blätter „Beispiel“ und „Blanko“) und `examples/beispiel-einheiten.csv` erzeugt `npm run examples` aus denselben Funktionen, die die App für den Download nutzt.
