# 0002 Preact + @preact/signals

Status: vorgeschlagen (E4)

## Entscheidung
UI mit Preact 11 und `@preact/signals`. esbuild kompiliert TSX ohne Plugin. Der Anwendungszustand liegt in wenigen Signals (`history`, `selection`, `ui`), abgeleitete Werte (gefilterter Teilgraph, Layout, Szene, Kennwerte) sind `computed`.

## Konsequenzen
- ca. 15 kB im Bundle.
- Preact escapet Text. `innerHTML`/`dangerouslySetInnerHTML` wird nicht verwendet (Ausnahme: keine).
