# 0013 Leistung (Phase 0: Morph-Prototyp)

Status: vorgeschlagen

## Messung (Playwright, headless, Entwicklungsrechner, 2026-11-20, `tests/e2e/perf.spec.ts`)

| Messung | Chromium | Firefox | Ziel §14 |
|---|---|---|---|
| Morph Organigramm → Sternnetz, 300 OEs | 59 fps | 44 fps | ≥ 30 fps |
| Morph Sternnetz → Organigramm, 300 OEs | 60 fps | 55 fps | ≥ 30 fps |
| Sichtwechsel 1000 OEs (inkl. 700 ms Wartezeit) | 1,0–2,2 s | 1,1–2,5 s | bedienbar |
| Bearbeiten (Kürzel ändern) 1000 OEs | 0,36 s | 0,43 s | bedienbar |
| Dateigröße `orgamorph.html` | 242 kB | | < 400 kB |

### GitHub-Actions-Runner (ubuntu-latest, 2 vCPU, ohne GPU), 2026-11-20

| Messung | Chromium | Firefox |
|---|---|---|
| Morph → Sternnetz / → Organigramm, 300 OEs | 36 / 42 fps | 32 / 21 fps |
| Sichtwechsel 1000 OEs, Netz-Sicht | 3,1 s | 4,3 s |

Auf schwacher Hardware unterschreitet Firefox beim Morph zurück ins Organigramm die 30 fps; die Netz-Sicht braucht bei 1000 OEs mehrere Sekunden für das erste Layout.

## Entscheidung
- Morph interpoliert Mittelpunkt, Breite, Höhe und Eckenradius (Rechteck → Kreis) in einer eigenen `requestAnimationFrame`-Schleife. Kanten sind während des Morphs ausgeblendet, Texte blenden in den letzten 40 % ein. Bei `prefers-reduced-motion` gibt es keine Animation.
- Das Kraft-Layout der Netz-Sicht ist am teuersten (300 Ticks). Es wird über einen **Strukturschlüssel** (Knoten, Kanten, Gewichte, Pins) zwischengespeichert. Textänderungen lösen keine neue Simulation aus.

- Die Leistungsmessung (`tests/e2e/perf.spec.ts`) läuft **nicht** in der CI, weil geteilte Runner stark schwanken, sondern lokal mit `npm run test:perf`.

## Offen
- Messung auf typischer Verwaltungshardware (Thin Client, Virtualisierung).
- Mögliche Verbesserungen bei 1000+ OEs: Kraft-Layout in einem Web Worker (unter `file://` nur als Blob-Worker möglich, CSP `worker-src blob:` nötig) oder weniger Iterationen bei großen Graphen; Morph mit vereinfachter Darstellung (ohne Texte) für große Organigramme.
