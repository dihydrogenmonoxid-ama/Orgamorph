# 0003 Eigenes SVG-Rendering über eine DOM-freie Szene

Status: vorgeschlagen (E5)

## Kontext
§6 verlangt, dass `io/svg.ts` die Grafik „für Bildschirm UND Export“ erzeugt. Ein SVG-String auf dem Bildschirm müsste per `innerHTML` eingesetzt werden. Das widerspricht §14 („kein `innerHTML` mit Nutzerdaten“) und erschwert Interaktion (Hover, Klick, Fokus).

## Entscheidung
Zweistufig:
1. `core/io/svg.ts → buildScene()` erzeugt aus Dokument, Filter, Layout und Beschriftungsoptionen eine **Szene**: eine flache Liste von Grundformen (`rect`, `circle`, `path`, `text`, `group`) mit Klassen, Farben und Bezug zur OE/zum Projekt. Reines TS, testbar.
2. Zwei Ausgaben derselben Szene:
   - `sceneToSvgString()` (Core) für SVG-, PNG- und Druckexport, mit striktem XML-Escaping.
   - `ui/SceneView.tsx` rendert die Szene als Preact-SVG (Hover, Klick, Morph).

Layouts: `d3-hierarchy` (Baum), Eigenbau (Balloon), `d3-force` (Netz). Kein Cytoscape.

## Konsequenzen
- Bildschirm und Export zeigen garantiert dasselbe.
- Die Datenschutzregel (Namen/Stellennummern) wird an **einer** Stelle durchgesetzt (`buildScene`) und dort getestet.
