# 0011 Textbreiten ohne DOM

Status: vorgeschlagen

## Kontext
Kastengrößen im Organigramm hängen von der Textbreite ab. Der Core darf kein DOM (und kein Canvas) verwenden, Layouts müssen deterministisch und testbar sein.

## Entscheidung
`core/layout/textMetrics.ts` schätzt Breiten mit einer Zeichenklassen-Tabelle (Werte in em, abgeleitet aus Arial/Helvetica, die im Systemschrift-Stack die breiteste Variante darstellen) und rundet nach oben. Lange Texte werden an Wortgrenzen auf höchstens zwei Zeilen umbrochen, danach mit „…“ gekürzt.

## Konsequenzen
Kästen sind eher etwas zu breit als zu schmal. Bildschirm, SVG und PDF verwenden dieselben Maße.
