# Changelog

Alle nennenswerten Änderungen. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach SemVer. Ab dem ersten Release pflegt release-please diese Datei.

## [Unreleased] – 0.1.0 (MVP)

### Hinzugefügt
- Einzelne HTML-Datei `orgamorph.html` mit eingebettetem Skript, CSP mit SHA-256-Hash, keine Netzwerkzugriffe.
- Datenmodell mit Commands, Undo/Redo (300 Schritte, Zusammenfassen von Eingaben innerhalb 1 s), Validierung und JSON-Format `schemaVersion 1` mit Schema.
- Struktur-Editor mit vollständiger Tastaturbedienung, Formulare für Einheiten, Projekte & Themen und Beziehungen, Beteiligungsmatrix.
- Sichten Organigramm (gestapelte Blattebene, links-rechts, Stabsstellen seitlich), Sternnetz und Netz mit animiertem Übergang, lokalem Graphen und gewichteten Kanten.
- Filter: Fokus, Außenkontakte, Stichtag, Typen, einzelne Projekte, Beziehungsarten.
- Kennwerte: Tiefe, Breite, Leitungsspanne, Schnittstellen, Top 10, Vermaschungsgrad.
- Speichern im Datei-Modus (File System Access) oder Browser-Modus, Autosave mit Konflikterkennung.
- Import: Gliederungstext, CSV (Einheiten, Projekte). Export: PDF über die Druckansicht (A4/A3, Schriftfeld, Legende, Lesbarkeitsprüfung), SVG, PNG, JSON, CSV, Gliederungstext.
- Namen und Stellennummern sind in allen Ausgaben standardmäßig ausgeblendet.
- Deutsch und Englisch, zwei Beispiele (Stadtverwaltung nach KGSt-Verwaltungsgliederungsplan, einfache Firma).
- Import von Einheiten und Projekten aus Excel (XLSX) und CSV, auf der Startseite und im Werkzeug; Excel-Vorlage mit Blättern „Beispiel“ und „Blanko“, Beispiel-CSV.
- Plankopf im PDF mit Titel, Organisation, Organisationseinheit, Ersteller und Logo.
- Klick auf „Orgamorph“ speichert und führt zur Startseite; GitHub-Link auf der Startseite und unter „Über“.
