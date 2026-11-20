# 0010 Dokument-ID im Dateiformat

Status: vorgeschlagen

## Kontext
§5.1 verlangt, Browser-Speicher immer mit Dokument-ID als Schlüssel zu verwenden. §7.1 führt kein ID-Feld für das Dokument.

## Entscheidung
`OrgDocument.id` (Präfix `d_`, 10 Zeichen) steht in der Datei nach `schemaVersion`. Dateien ohne `id` bekommen beim Laden eine neue (Migration, keine Schemaversionserhöhung, weil das Feld additiv und optional ist). „Als Kopie speichern“ vergibt eine neue ID.
