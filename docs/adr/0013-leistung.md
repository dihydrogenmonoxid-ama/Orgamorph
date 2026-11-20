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

## Entscheidung
- Morph interpoliert Mittelpunkt, Breite, Höhe und Eckenradius (Rechteck → Kreis) in einer eigenen `requestAnimationFrame`-Schleife. Kanten sind während des Morphs ausgeblendet, Texte blenden in den letzten 40 % ein. Bei `prefers-reduced-motion` gibt es keine Animation.
- Das Kraft-Layout der Netz-Sicht ist am teuersten (300 Ticks). Es wird über einen **Strukturschlüssel** (Knoten, Kanten, Gewichte, Pins) zwischengespeichert. Textänderungen lösen keine neue Simulation aus.

## Offen
Messung auf schwächerer Hardware (Verwaltungs-PC, Thin Client) steht aus.
