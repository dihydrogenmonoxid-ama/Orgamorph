// Import-Vorlagen: Beispiel-CSV und Excel-Mappe („Beispiel“ + „Blanko“) zum Eintragen der Struktur.
// Spaltenköpfe sind die deutschen Aliase des CSV-Imports (siehe csv.ts), damit Vorlagen ohne Umbenennen importierbar sind.

import { toCsv } from "./csv.ts";
import { writeXlsx } from "./xlsx.ts";

export const TEMPLATE_HEADER = [
  "ID",
  "Übergeordnet",
  "Bezeichnung",
  "Kürzel",
  "Typ",
  "Funktion",
  "Funktionskürzel",
  "Stellennummer",
  "Besetzung",
  "Aufgabenbereich",
  "Stabsstelle",
  "Notiz",
] as const;

export const TEMPLATE_HEADER_EN = [
  "id",
  "parentId",
  "name",
  "shortName",
  "type",
  "leadTitle",
  "leadCode",
  "positionNumber",
  "holder",
  "responsibilities",
  "isStaff",
  "note",
] as const;

const WIDTHS = [8, 14, 32, 10, 16, 24, 16, 14, 20, 32, 11, 24];

/** Beispielstruktur einer einfachen Firma (frei erfunden). */
export const TEMPLATE_EXAMPLE_ROWS: readonly (readonly string[])[] = [
  [
    "1",
    "",
    "Geschäftsführung",
    "GF",
    "Geschäftsführung",
    "Geschäftsführer",
    "GF",
    "",
    "",
    "Gesamtleitung",
    "",
    "",
  ],
  [
    "2",
    "1",
    "Assistenz der Geschäftsführung",
    "AS",
    "Stabsstelle",
    "",
    "",
    "",
    "",
    "Termine, Gremien",
    "x",
    "",
  ],
  ["3", "1", "Vertrieb", "VT", "Bereich", "Vertriebsleitung", "VL", "", "", "Kunden, Angebote", "", ""],
  ["4", "3", "Innendienst", "VT-I", "Team", "Teamleitung", "", "", "", "", "", ""],
  ["5", "3", "Außendienst", "VT-A", "Team", "Teamleitung", "", "", "", "", "", ""],
  ["6", "1", "Produktion", "PR", "Bereich", "Produktionsleitung", "PL", "", "", "Fertigung, Lager", "", ""],
  ["7", "6", "Fertigung", "PR-F", "Team", "Meister", "", "", "", "", "", ""],
  ["8", "6", "Lager und Versand", "PR-L", "Team", "Teamleitung", "", "", "", "", "", ""],
  ["9", "1", "Verwaltung", "VW", "Bereich", "Kaufmännische Leitung", "KL", "", "", "", "", ""],
  ["10", "9", "Buchhaltung", "BH", "Team", "", "", "", "", "", "", ""],
  ["11", "9", "Personal", "HR", "Team", "", "", "", "", "", "", ""],
];

export function templateRows(english = false): string[][] {
  return [[...(english ? TEMPLATE_HEADER_EN : TEMPLATE_HEADER)], ...TEMPLATE_EXAMPLE_ROWS.map((r) => [...r])];
}

/** Beispiel-CSV (Semikolon, UTF-8 mit BOM, CRLF – Excel-kompatibel). */
export function exampleCsv(english = false): string {
  return toCsv(templateRows(english));
}

/** Excel-Mappe mit Blatt „Beispiel“ (ausgefüllt) und Blatt „Blanko“ (nur Spaltenköpfe). */
export function templateXlsx(english = false): Uint8Array {
  const header = [...(english ? TEMPLATE_HEADER_EN : TEMPLATE_HEADER)];
  return writeXlsx([
    { name: english ? "Example" : "Beispiel", rows: templateRows(english), widths: WIDTHS },
    { name: english ? "Blank" : "Blanko", rows: [header], widths: WIDTHS },
  ]);
}
