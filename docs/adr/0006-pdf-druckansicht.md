# 0006 PDF über die Druckansicht

Status: vorgeschlagen (E9). Phase-0-Ergebnis siehe unten.

## Entscheidung
- Druckdialog in der App: A4/A3, Ausrichtung automatisch/hoch/quer, Rand.
- `core/layout/fit.ts` passt die Szene in den Inhaltsbereich ein (abzüglich Schriftfeld und Legende) und berechnet die kleinste Schriftgröße in pt.
- Ein eigenes `<style>`-Element setzt `@page { size: A3 landscape; margin: 0 }`. Ränder liegen im Inhalt. Dadurch druckt der Browser keine Kopf- und Fußzeilen.
- Druckinhalt ist ein eigener Container (`#print-root`) mit SVG aus `sceneToSvgString()`, Legende und Schriftfeld; alles andere ist per `@media print` ausgeblendet.

## Phase-0-Ergebnis (Playwright, 2026-11-20)

- `tests/e2e/print.spec.ts` erzeugt in Chromium per `page.pdf({ preferCSSPageSize: true })` aus der Druckseite ein PDF. A4 quer ergibt eine MediaBox von 842 × 595 pt, A3 hoch 842 × 1191 pt, jeweils **eine Seite**. Das dynamisch gesetzte `@page` wirkt also.
- `afterprint` räumt Druckseite und `@page`-Stil wieder ab.
- Abnahme 2 (Fokus auf eine Abteilung, A4 quer, kleinste Schrift ≥ 6 pt) läuft als E2E-Test in Chromium und Firefox.

## Manuell zu prüfen
- [ ] Chrome, Edge, Firefox: echter Druckdialog, „Als PDF speichern“, **keine Kopf- und Fußzeilen** des Browsers (`margin: 0`). In Firefox ggf. „Kopf- und Fußzeilen drucken“ abschalten, falls dort voreingestellt.
- [ ] Safari: `@page size` wird nur teilweise unterstützt; Format im Druckdialog kontrollieren.
