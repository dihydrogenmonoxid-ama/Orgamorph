import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectDelimiter,
  exportTopicsCsv,
  exportUnitsCsv,
  importTopicsCsv,
  importUnitsCsv,
  parseCsv,
  parseDate,
  parseTopicType,
  toCsv,
} from "../../../src/core/io/csv.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

test("Trennzeichen-Erkennung", () => {
  assert.equal(detectDelimiter("a;b;c\n1,2;3"), ";");
  assert.equal(detectDelimiter("a,b,c\n"), ",");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter('"a;b",c,d'), ",");
});

test("Parser: Anführungszeichen, Zeilenumbrüche im Feld, CRLF, BOM, leere Zeilen", () => {
  const rows = parseCsv('﻿name;note\r\n"Ref ""A""";"Zeile 1\nZeile 2"\r\n\r\nB;\n');
  assert.deepEqual(rows, [
    ["name", "note"],
    ['Ref "A"', "Zeile 1\nZeile 2"],
    ["B", ""],
  ]);
});

test("toCsv: BOM, CRLF, Quoting, Formelschutz", () => {
  const s = toCsv([
    ["a;b", 'x"y', "=SUMME(A1)", "-5", "-x"],
    ["1", "2", "3", "4", "5"],
  ]);
  assert.ok(s.startsWith("﻿"));
  assert.ok(s.endsWith("\r\n"));
  assert.deepEqual(parseCsv(s)[0], ["a;b", 'x"y', "'=SUMME(A1)", "-5", "'-x"]);
});

test("OE-Import: Spalten nach §7.5, eigene IDs, Kürzel als parentId", () => {
  const csv = [
    "id;parentId;name;shortName;type;leadTitle;leadCode;positionNumber;holder",
    "1;;Landratsamt;LRA;;Landrat;LR;;",
    "2;1;Abteilung 1;Abt 1;Abteilung;Abteilungsleitung;A1;01.100;Erika Muster",
    "3;Abt 1;Referat 1.1;Ref 1.1;Referat;;;;",
    "4;99;Verwaist;;;;;;",
    ";;;;",
  ].join("\n");
  let n = 0;
  const { units, issues } = importUnitsCsv(csv, () => `u_${String(++n).padStart(10, "0")}`);
  assert.equal(units.length, 4);
  const abt = units.find((u) => u.name === "Abteilung 1")!;
  assert.deepEqual(abt.lead, {
    title: "Abteilungsleitung",
    code: "A1",
    positionNumber: "01.100",
    holder: "Erika Muster",
  });
  assert.equal(units.find((u) => u.name === "Referat 1.1")!.parentId, abt.id);
  assert.deepEqual(issues, [{ code: "unknownParent", row: 5, value: "99" }]);
  assert.equal(units.find((u) => u.name === "Verwaist")!.parentId, null);
});

test("OE-Import: deutsche Spaltennamen, Komma, Zyklus, doppelte ID, fehlende Spalte", () => {
  const { units, issues } = importUnitsCsv(
    "ID,Übergeordnet,Bezeichnung,Kürzel,Stabsstelle\na,b,A,,x\nb,a,B,,\na,,C,,",
  );
  assert.equal(units.length, 2);
  assert.ok(issues.some((i) => i.code === "cycle"));
  assert.ok(issues.some((i) => i.code === "duplicateId"));
  assert.ok(units.find((u) => u.name === "A")!.isStaff);
  assert.deepEqual(importUnitsCsv("foo;bar\n1;2").issues, [{ code: "missingColumn", column: "name" }]);
});

test("Projekt-Import: Typen, Datumsformate, Beteiligte über Kürzel/Name/ID", () => {
  const doc = sampleDoc();
  const csv = [
    "title;type;from;to;lead;members",
    'E-Akte;Projekt;01.02.2026;2026-12-31;Ref 1.1;"Ref 2.1, Abteilung 2 | u_stab000001"',
    "Personalrat;Gremium;;;;Ref 9.9",
    "Kaputt;Quatsch;31.02.2026;;;",
    "Rückwärts;project;2026-05-01;2026-01-01;;",
  ].join("\n");
  const { topics, issues } = importTopicsCsv(csv, doc);
  assert.equal(topics.length, 4);
  const t = topics[0]!;
  assert.equal(t.type, "project");
  assert.deepEqual(t.period, { from: "2026-02-01", to: "2026-12-31" });
  assert.deepEqual(t.participants, [
    { unitId: "u_ref1100001", role: "lead" },
    { unitId: "u_ref2100001", role: "member" },
    { unitId: "u_abt2000001", role: "member" },
    { unitId: "u_stab000001", role: "member" },
  ]);
  assert.equal(topics[1]!.type, "committee");
  assert.equal(topics[2]!.type, "other");
  assert.deepEqual(topics[3]!.period, { from: "2026-05-01" });
  assert.deepEqual(
    issues.map((i) => i.code),
    ["unknownUnit", "unknownType", "invalidDate", "invalidDate"],
  );
  assert.equal(t.color, "#CC79A7", "Farben setzen nach vorhandenen Projekten fort");
});

test("Typ- und Datumserkennung", () => {
  assert.equal(parseTopicType("Arbeitskreis"), "workingGroup");
  assert.equal(parseTopicType("Querschnittsaufgabe"), "crossCutting");
  assert.equal(parseTopicType(""), "project");
  assert.equal(parseTopicType("xyz"), null);
  assert.equal(parseDate("1.2.2026"), "2026-02-01");
  assert.equal(parseDate(""), undefined);
  assert.equal(parseDate("2026/01/01"), null);
});

test("Abnahme 6: CSV-Export ohne Namen und Stellennummern, solange nicht eingeschaltet", () => {
  const doc = sampleDoc();
  const off = exportUnitsCsv(doc, { holder: false, positionNumber: false });
  assert.ok(!off.includes("Max Mustermann") && !off.includes("01.100"));
  const on = exportUnitsCsv(doc, { holder: true, positionNumber: true });
  assert.ok(on.includes("Max Mustermann") && on.includes("01.100"));
  // Roundtrip
  const back = importUnitsCsv(on);
  assert.equal(back.units.length, doc.units.length);
  assert.deepEqual(back.issues, []);
  // Filter: Teilbaum, Wurzel des Teilbaums ohne parentId
  const sub = exportUnitsCsv(
    doc,
    { holder: false, positionNumber: false },
    new Set(["u_abt1000001", "u_ref1100001"]),
  );
  const rows = parseCsv(sub);
  assert.equal(rows.length, 3);
  assert.equal(rows[1]![1], "");
});

test("Projekt-Export und Roundtrip", () => {
  const doc = sampleDoc();
  const csv = exportTopicsCsv(doc);
  const rows = parseCsv(csv);
  assert.deepEqual(rows[1], [
    "Digitalisierung",
    "",
    "project",
    "2026-01-01",
    "2026-12-31",
    "Ref 1.1",
    "Ref 2.1, Stab",
    "",
  ]);
  const back = importTopicsCsv(csv, doc);
  assert.deepEqual(back.issues, []);
  assert.deepEqual(back.topics[0]!.participants, doc.topics[0]!.participants);
  assert.equal(parseCsv(exportTopicsCsv(doc, new Set(["t_alt0000001"]))).length, 2);
});
