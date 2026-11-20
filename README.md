# Orgamorph

**Vom Organigramm zum Netzwerk.**
Machen Sie sichtbar, wie Ihre Organisation wirklich arbeitet: Einheiten, Themen, Schnittstellen.

Deutsch · [English](README.en.md)

<!-- TODO: Animiertes GIF: Organigramm verwandelt sich in ein Sternnetz, Projekte legen sich farbig darüber -->

---

Jede Organisation hat ein Organigramm. Es zeigt, wer wem unterstellt ist.
Was es nicht zeigt: wer mit wem an welchem Thema arbeitet, wo Abteilungen aufeinander angewiesen sind und an welchen Stellen alles zusammenläuft.

Die eigentliche Arbeit findet quer zur Linie statt: in Projekten, Arbeitsgruppen, Gremien und Querschnittsaufgaben. Genau dort entstehen Reibung, Abstimmungsaufwand und Abhängigkeiten. Und genau das bleibt im Organigramm unsichtbar.

**Orgamorph macht es sichtbar.** Sie erfassen Ihre Struktur wie gewohnt, ergänzen Projekte und Themen, und mit einem Klick verwandelt sich das Organigramm in ein Netzwerk. Dann sieht man, wo es sich verdichtet, wer mit wem verbunden ist und welche Einheiten an vielen Fäden zugleich hängen.

## Was Orgamorph kann

**Organisation erfassen, ohne zu zeichnen**

- Organisationseinheiten mit Name, Kürzel, Typ und Aufgabenbereich
- Leitung mit Funktion, Funktionskürzel und optional Stellennummer und Name
- Klare Gliederung nach dem Eltern-Kind-Prinzip: Behördenleitung, Abteilungen, Referate, Sachgebiete, Stabsstellen
- Schnell per Tastatur oder per Import aus Excel (XLSX) bzw. CSV, mit fertiger Vorlage

**Projekte, Themen und Beziehungen darüberlegen**

- Projekte, Arbeitsgruppen, Gremien und Querschnittsaufgaben mit Zeitraum (von–bis oder dauerhaft)
- Beteiligte Einheiten, federführend oder mitwirkend, direkt aus der Struktur gewählt
- Beziehungen neben der Linie: wer berichtet an wen, wer weist fachlich an, wer informiert wen

**Drei Blickwinkel auf dieselbe Organisation**

- **Organigramm:** die formale Struktur, sauber gesetzt
- **Sternnetz:** dieselbe Struktur, von der Mitte her gedacht. Der Übergang ist animiert, damit man sieht, dass es dieselbe Organisation ist.
- **Netz:** die gelebte Zusammenarbeit. Je mehr gemeinsame Projekte zwei Einheiten haben, desto näher rücken sie zusammen und desto stärker ist ihre Verbindung.

**Gezielt hinsehen**

- Fokus auf einen Bereich: „Nur Abteilung 1 mit ihren Referaten“ und auf Wunsch die Kontakte nach außen
- Stichtag: Welche Projekte liefen am 1. März?
- Kennwerte: Leitungsspannen, Schnittstellen, Projektbeteiligung je Einheit, Vernetzungsgrad

**Ausgeben**

- PDF auf A4 oder A3, automatisch eingepasst, mit Schriftfeld und Legende
- SVG zum Weiterbearbeiten, PNG für Präsentationen
- Namen und Stellennummern sind in jeder Ausgabe standardmäßig ausgeblendet

## Loslegen in einer Minute

1. Die Datei `orgamorph-vX.Y.Z.html` unter [Releases](../../releases) herunterladen.
2. Doppelklicken.
3. Fertig.

Keine Installation, kein Server, kein Konto, keine Cloud. Orgamorph ist eine einzige HTML-Datei, die in Ihrem Browser läuft. Sie funktioniert auch ohne Internetverbindung, auf dem Dienstrechner wie auf dem Laptop.

Zum Ausprobieren liegen zwei Beispiele bei: eine Stadtverwaltung nach dem KGSt-Verwaltungsgliederungsplan und eine einfache Firma. Für die eigene Struktur gibt es eine Excel-Vorlage mit einem Beispiel- und einem Blanko-Blatt.

## Ihre Daten bleiben bei Ihnen

Orgamorph sendet nichts. Keine Telemetrie, keine Analyse, keine externen Schriften oder Bibliotheken. Die Anwendung ist technisch so abgesichert, dass sie gar keine Netzwerkverbindung aufbauen kann.

Gespeichert wird in einer Datei (`*.orgamorph.json`), die Sie selbst ablegen: im Projektordner, auf dem Netzlaufwerk, in einem Git-Repository. Nach jeder Änderung wird automatisch gespeichert, und mit `Strg+Z` lässt sich jeder Schritt zurücknehmen.

| Browser         | Speichern                                                           |
| --------------- | ------------------------------------------------------------------- |
| Chrome, Edge    | Speicherort einmal wählen, danach automatisch direkt in die Datei   |
| Firefox, Safari | Automatisch im Browser, zusätzlich „Als Datei sichern“ per Download |

## Für wen

- **Führungskräfte**, die wissen wollen, wo ihr Bereich mit anderen verflochten ist
- **Organisationsentwicklung und Verwaltungsmodernisierung**, um Ist-Zustände zu zeigen und Umbauten zu diskutieren
- **Projekt- und Programmleitungen**, um Beteiligte und Schnittstellen auf einen Blick zu haben
- **Feuerwehr, Rettungsdienst, Katastrophenschutz**, um Stabsstrukturen und Verbindungen zu anderen Organisationen darzustellen
- **Beratung, Lehre und Studium**, um Organisationstheorie anschaulich zu machen

## Hintergrund

Organisationen sind längst Netzwerke. Die Frage ist nicht, _ob_ wir in Netzwerken arbeiten, sondern _wie gut_. Orgamorph stützt sich auf etablierte Konzepte:

- **Netzwerktopologien:** Stern, Baum, Linie, teil- und vollvermascht, mit ihren Stärken und Schwächen bei Ausfallsicherheit und Koordinationsaufwand
- **Organigraphs** nach Mintzberg & Van der Heyden (1999): Organisationen nicht nur als Kästchen, sondern als Ketten, Knotenpunkte und Netze denken
- **Vermittlerrollen** nach Gould & Fernandez (1989): Koordinator, Gatekeeper, Repräsentant, Berater, Verbindungsglied. Wer Informationen weiterleitet, filtert oder Bereiche verbindet, hat Einfluss, auch ohne Leitungsfunktion. (Geplant für Version 0.2.)

Mehr dazu in [docs/theorie.md](docs/theorie.md).

## Datenschutz und Mitbestimmung

Orgamorph ist für Strukturen gedacht, also für Organisationseinheiten und Stellen. Namen sind immer optional. Wer reale Personen erfasst oder Auswertungen über Personen erstellt, sollte die Datenschutz-Grundverordnung beachten und den Personal- oder Betriebsrat frühzeitig einbeziehen. Dieser Hinweis ist keine Rechtsberatung.

## Stand und Ausblick

Orgamorph ist in Entwicklung. Version 0.1 ist in Vorbereitung.

- **0.1:** Erfassung, drei Sichten, Projekte und Beziehungen, Filter, Kennwerte, PDF/SVG/PNG
- **0.2–0.4:** Engpässe und kritische Stellen, Ausfallsimulation („Was wäre, wenn diese Einheit ausfällt?“), Vermittlerrollen nach Gould & Fernandez
- **Später:** Geschäftsverteilungsplan mit Aufgaben und Vertretungsregelungen, Soll-Ist-Vergleich, Zeitleiste

Den vollständigen Plan und alle Änderungen finden Sie im [CHANGELOG](CHANGELOG.md).

## Selbst bauen

Voraussetzung: Node.js (aktuelle LTS-Version).

```bash
git clone https://github.com/<github-user>/orgamorph.git
cd orgamorph
npm ci
npm run build      # erzeugt dist/orgamorph.html
```

Die Datei `dist/orgamorph.html` öffnen Sie direkt im Browser. Für die Entwicklung baut `npm run watch` bei jeder Änderung neu, dann laden Sie die Seite einfach neu. Einen Server braucht es auch dabei nicht.

## Mitwirken

Rückmeldungen, Fehlerberichte und Ideen sind willkommen, gerade aus der Praxis von Verwaltungen, Unternehmen und Einsatzorganisationen. Bitte nutzen Sie die [Issues](../../issues). Für Beiträge zum Code: Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/), Architekturentscheidungen in [docs/adr](docs/adr/README.md).

## Lizenz

[EUPL-1.2](LICENSE), die Open-Source-Lizenz der Europäischen Union. Sie gilt in allen Amtssprachen der EU gleichermaßen, also auch in der deutschen Fassung.
