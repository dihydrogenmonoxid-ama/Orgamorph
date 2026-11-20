import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { importTopicsRows, importUnitsRows, parseDate } from "../../../src/core/io/csv.ts";
import { exampleCsv, TEMPLATE_HEADER, templateXlsx } from "../../../src/core/io/templates.ts";
import {
  colIndex,
  colName,
  parseSharedStrings,
  parseSheet,
  pickImportSheet,
  readXlsx,
  writeXlsx,
  xmlUnescape,
} from "../../../src/core/io/xlsx.ts";
import { crc32, isZip, readZip, writeZip, ZipError } from "../../../src/core/io/zip.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

const inflate = async (d: Uint8Array) => new Uint8Array(inflateRawSync(d));

test("CRC-32 (Prüfwert)", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("ZIP: schreiben und lesen (stored), deterministisch", async () => {
  const z = writeZip([
    { name: "a.txt", data: "Hallo Ä" },
    { name: "dir/b.bin", data: new Uint8Array([1, 2, 3]) },
  ]);
  assert.ok(isZip(z));
  assert.deepEqual(
    writeZip([
      { name: "a.txt", data: "Hallo Ä" },
      { name: "dir/b.bin", data: new Uint8Array([1, 2, 3]) },
    ]),
    z,
  );
  const files = await readZip(z, inflate);
  assert.equal(new TextDecoder().decode(files.get("a.txt")), "Hallo Ä");
  assert.deepEqual([...files.get("dir/b.bin")!], [1, 2, 3]);
  await assert.rejects(readZip(new Uint8Array(30), inflate), ZipError);
});

test("ZIP: Deflate-Einträge werden über die Callback-Funktion entpackt", async () => {
  // Archiv mit stored-Eintrag erzeugen und Methode/Größe auf deflate umschreiben
  const payload = new TextEncoder().encode("x".repeat(500));
  const comp = new Uint8Array(deflateRawSync(payload));
  const z = writeZip([{ name: "c.txt", data: comp }]);
  const v = new DataView(z.buffer);
  v.setUint16(8, 8, true); // local: Methode
  const cen = z.length - 22 - (46 + 5);
  v.setUint16(cen + 10, 8, true); // central: Methode
  const files = await readZip(z, inflate);
  assert.equal(new TextDecoder().decode(files.get("c.txt")), "x".repeat(500));
});

test("Spaltenbuchstaben", () => {
  assert.equal(colName(0), "A");
  assert.equal(colName(25), "Z");
  assert.equal(colName(26), "AA");
  assert.equal(colIndex("AB12"), 27);
  assert.equal(colIndex("c3"), 2);
});

test("XLSX: Roundtrip mit Sonderzeichen und Lücken", async () => {
  const bytes = writeXlsx([
    { name: "Blatt 1", rows: [["Kopf", "B"], ["<&>\"'", "", "C"], [], ["Ü", "10.1"]] },
    { name: "Leer", rows: [] },
  ]);
  const sheets = await readXlsx(bytes, inflate);
  assert.deepEqual(
    sheets.map((s) => s.name),
    ["Blatt 1", "Leer"],
  );
  assert.deepEqual(sheets[0]!.rows, [["Kopf", "B"], ["<&>\"'", "", "C"], [], ["Ü", "10.1"]]);
});

test("XLSX lesen: gemeinsame Zeichenketten, Zahlen, Rich Text, Wahrheitswerte, fehlende r-Attribute", () => {
  const shared = parseSharedStrings(
    '<sst><si><t>Abt 1</t></si><si><r><t>Fett</t></r><r><t xml:space="preserve"> und normal</t></r></si><si/></sst>',
  );
  assert.deepEqual(shared, ["Abt 1", "Fett und normal", ""]);
  const rows = parseSheet(
    '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>0.30000000000000004</v></c></row>' +
      '<row r="3"><c t="s"><v>1</v></c><c t="b"><v>1</v></c><c t="str"><v>a&amp;b</v></c><c r="E3" t="inlineStr"><is><t>inl</t></is></c></row></sheetData>',
    shared,
  );
  assert.deepEqual(rows, [["Abt 1", "", "0.3"], [], ["Fett und normal", "1", "a&b", "", "inl"]]);
  assert.equal(xmlUnescape("&#x41;&#66;&lt;"), "AB<");
});

test("Importblatt wählen: ausgefülltes Blanko vor Beispiel, sonst Beispiel", () => {
  const ex = { name: "Beispiel", rows: [["Bezeichnung"], ["A"]] };
  const blank = { name: "Blanko", rows: [["Bezeichnung"]] };
  assert.equal(pickImportSheet([ex, blank])?.name, "Beispiel");
  const filled = { name: "Blanko", rows: [["Bezeichnung"], ["B"]] };
  assert.equal(pickImportSheet([ex, filled])?.name, "Blanko");
  assert.equal(pickImportSheet([{ name: "x", rows: [["h"]] }]), undefined);
});

test("Vorlagen: XLSX mit Beispiel und Blanko, importierbar; CSV importierbar", async () => {
  const sheets = await readXlsx(templateXlsx(), inflate);
  assert.deepEqual(
    sheets.map((s) => s.name),
    ["Beispiel", "Blanko"],
  );
  assert.deepEqual(sheets[1]!.rows, [[...TEMPLATE_HEADER]]);
  const r = importUnitsRows(sheets[0]!.rows);
  assert.deepEqual(r.issues, []);
  assert.equal(r.units.length, 11);
  assert.equal(r.units.filter((u) => u.parentId === null).length, 1);
  assert.ok(r.units.find((u) => u.name === "Assistenz der Geschäftsführung")?.isStaff);
  assert.equal(
    r.units.find((u) => u.name === "Innendienst")?.parentId,
    r.units.find((u) => u.name === "Vertrieb")?.id,
  );
  const en = await readXlsx(templateXlsx(true), inflate);
  assert.equal(importUnitsRows(en[0]!.rows).units.length, 11);
  const csv = exampleCsv();
  assert.ok(csv.startsWith("﻿ID;Übergeordnet;Bezeichnung"));
});

test("Projekte aus Zeilen inkl. Excel-Seriendatum", () => {
  assert.equal(parseDate("46023"), "2026-01-01");
  assert.equal(parseDate("46023.5"), "2026-01-01");
  assert.equal(parseDate("12345"), null);
  const { topics, issues } = importTopicsRows(
    [
      ["Titel", "Typ", "Von", "Bis", "Federführung", "Mitwirkung"],
      ["E-Akte", "Projekt", "46023", "", "Ref 1.1", "Ref 2.1"],
    ],
    sampleDoc(),
  );
  assert.deepEqual(issues, []);
  assert.deepEqual(topics[0]!.period, { from: "2026-01-01" });
  assert.equal(topics[0]!.participants.length, 2);
});
