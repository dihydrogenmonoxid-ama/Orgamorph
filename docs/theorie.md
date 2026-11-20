# Theorie: Topologien und Kennwerte

Deutsch · [English](theory.en.md)

Orgamorph legt zwei Sichtweisen auf eine Organisation übereinander: die **formale Linie** (wer wem unterstellt ist) und die **gelebte Zusammenarbeit** (wer mit wem an Projekten und Themen arbeitet, wer wen informiert). Diese Seite erklärt die Darstellungen und Kennwerte. Alle Kennwerte beschreiben Strukturen. Sie bewerten nicht.

## Drei Sichten auf denselben Graphen

Eine Organisation ist mathematisch ein **Graph**: Einheiten sind Knoten, Verbindungen sind Kanten. Die Linie bildet einen **Baum** (jede Einheit hat genau eine übergeordnete Einheit, es gibt keine Kreise).

| Sicht | Layout | Was sie zeigt |
|---|---|---|
| Organigramm | Reingold-Tilford (geordneter Baum, Ebenen untereinander) | Hierarchie, Ebenen, Leitungsspannen |
| Sternnetz | Balloon-Layout (Kinder kreisförmig um den Elternknoten) | Dieselbe Hierarchie von der Mitte her. Projekte als farbige Linienzüge zeigen, welche Bereiche sie verbinden. |
| Netz | kraftbasiert (Federn und Abstoßung) | Zusammenarbeit: Einheiten mit vielen gemeinsamen Projekten rücken zusammen |

Organigramm und Sternnetz sind **derselbe Baum in zwei Layouts**. Der animierte Übergang macht das sichtbar.

Im **Netz** wirken drei Kräfte: Abstoßung zwischen allen Knoten, Federn entlang der Linie (schwach) und Federn entlang der Zusammenarbeit (stärker, je mehr gemeinsame Projekte). Gleiche Daten ergeben durch einen festen Zufallsstartwert immer dasselbe Bild.

### Projekte im Sternnetz: minimaler Spannbaum

Ein Projekt verbindet mehrere Einheiten. Orgamorph zeichnet es als **minimalen Spannbaum** über die Positionen der Beteiligten: die kürzeste Linienführung, die alle Beteiligten verbindet. So bleibt das Bild auch bei vielen Beteiligten lesbar.

## Kennwerte

Alle Kennwerte beziehen sich auf den aktuellen Filter (Fokus, Stichtag, Typen).

**Hierarchietiefe** ist die Zahl der Ebenen unterhalb der obersten Einheit. **Breite je Ebene** ist die Zahl der Einheiten pro Ebene.

**Leitungsspanne** (*span of control*) ist die Zahl der direkt unterstellten Einheiten. Orgamorph zeigt Minimum, Median und Maximum und gibt einen Hinweis, wenn eine Einheit mehr als den eingestellten Wert hat (Vorgabe 7). Der Wert ist eine Orientierung, keine Norm: Welche Spanne angemessen ist, hängt von Aufgaben, Selbstständigkeit und Unterstützung ab.

**Schnittstellen** sind Paare von Einheiten aus **verschiedenen Bereichen**, die ein gemeinsames Projekt oder eine Beziehung verbindet. Ein Bereich ist der Teilbaum unterhalb einer Einheit der ersten Ebene (bzw. unterhalb der Fokus-Einheit). Schnittstellen zeigen, wo Abstimmung über Bereichsgrenzen nötig ist.

**Vermaschungsgrad** (*meshedness*) misst, wie weit das Netz über einen reinen Baum hinausgeht:

```
           E − (n − k)
M = ─────────────────────────
     n(n − 1)/2 − (n − k)
```

mit `n` Knoten, `E` verschiedenen Kanten (Linie, Zusammenarbeit, Beziehungen, ungerichtet) und `k` Zusammenhangskomponenten. `n − k` ist die Kantenzahl eines aufspannenden Waldes, `n(n−1)/2` die eines vollständigen Graphen. `M = 0` bedeutet: reiner Baum, keine Querverbindungen. `M = 1` bedeutet: jede Einheit ist mit jeder verbunden.

## Ausblick (Phase 2)

- **Engpässe:** Betweenness-Zentralität nach Brandes (2001) zeigt Einheiten, über die viele kürzeste Wege laufen.
- **Kritische Knoten:** Artikulationspunkte, deren Ausfall das Netz zerteilt. Dazu gehört die Simulation „Was wäre, wenn … ausfällt?“.
- **Vermittlerrollen nach Gould und Fernandez (1989):** In gerichteten Beziehungen vermittelt B zwischen A und C (A → B → C). Je nach Gruppenzugehörigkeit von A, B und C unterscheidet man Koordinator (alle in einer Gruppe), Berater (A und C in einer Gruppe, B außerhalb), Gatekeeper (B und C in einer Gruppe, A außerhalb), Repräsentant (A und B in einer Gruppe, C außerhalb) und Verbindungsglied (alle in verschiedenen Gruppen).
- **Organigraphen nach Mintzberg und Van der Heyden (1999):** Vorlagen für Set, Chain, Hub und Web.

## Quellen

- Brandes, U. (2001): A Faster Algorithm for Betweenness Centrality. *Journal of Mathematical Sociology* 25(2), 163–177.
- Gould, R. V. & Fernandez, R. M. (1989): Structures of Mediation. *Sociological Methodology* 19, 89–126.
- Hanneman, R. & Riddle, M.: *Introduction to Social Network Methods*, Kap. 9.5.
- Mintzberg, H. & Van der Heyden, L. (1999): Organigraphs. *Harvard Business Review* 77(5), 87–94.
- Reingold, E. M. & Tilford, J. S. (1981): Tidier Drawings of Trees. *IEEE Transactions on Software Engineering* SE-7(2), 223–228.
