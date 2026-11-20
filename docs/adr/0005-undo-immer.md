# 0005 Undo/Redo mit Immer

Status: vorgeschlagen (E8)

## Entscheidung
- Jede Mutation ist ein `Command` (`core/commands.ts`) mit Label, optionalem `coalesceKey` und einer Immer-Rezeptur. Abgelehnte Commands werfen `CommandRejected`.
- `core/history.ts` hält `past / present / future` als unveränderliche Dokument-Wurzeln (strukturelles Teilen), max. 300 Schritte. Gleicher `coalesceKey` innerhalb 1 s ergibt einen Schritt.
- Undo/Redo übernimmt `view` (Sicht, Filter, Beschriftung) vom aktuellen Stand und nur `view.network.pinned` aus dem Zielstand.
- Sichtänderungen (`setView`) erzeugen keinen Schritt und ändern `meta.modified` nicht.
- Commands lassen `view.filter` unberührt. Verweise auf gelöschte Objekte (Fokus, ausgeblendete Projekte) ignoriert `filter.ts`. So stellt Undo alles vollständig wieder her.
- `units` wird nach strukturellen Änderungen in Tiefensuche-Reihenfolge gehalten (Eltern vor Kindern). Das macht die Datei lesbar und Diffs klein.
