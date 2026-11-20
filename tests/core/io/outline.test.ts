import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureSingleRoot, parseLine, parseOutline, toOutline } from "../../../src/core/io/outline.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

const ids = () => {
  let n = 0;
  return () => `u_${String(++n).padStart(10, "0")}`;
};

test("Einrückung mit Tab, 2 Leerzeichen und Aufzählungszeichen", () => {
  const text =
    "Behördenleitung\n\tAbt 1 | Abteilung 1\n\t\t- Referat 1.1\n    * Referat 1.2\n  Abteilung 2\n\n  • Abteilung 3\n";
  const { units, adjustedLines } = parseOutline(text, ids());
  assert.deepEqual(
    units.map((u) => [u.name, u.shortName ?? null, u.parentId]),
    [
      ["Behördenleitung", null, null],
      ["Abteilung 1", "Abt 1", "u_0000000001"],
      ["Referat 1.1", null, "u_0000000002"],
      ["Referat 1.2", null, "u_0000000002"],
      ["Abteilung 2", null, "u_0000000001"],
      ["Abteilung 3", null, "u_0000000001"],
    ],
  );
  assert.deepEqual(adjustedLines, []);
});

test("Sprünge in der Einrückung werden auf eine Ebene begrenzt", () => {
  const { units, adjustedLines } = parseOutline("A\n      B\nC", ids());
  assert.equal(units[1]!.parentId, units[0]!.id);
  assert.deepEqual(adjustedLines, [2]);
  assert.equal(units[2]!.parentId, null);
});

test("Zeilen: Kürzel | Name, nummerierte Listen, leere Teile", () => {
  assert.deepEqual(parseLine("1. Ref 1 | Referat 1"), { name: "Referat 1", shortName: "Ref 1" });
  assert.deepEqual(parseLine("| Nur Name"), { name: "Nur Name" });
  assert.deepEqual(parseLine("Nur Kürzel |"), { name: "Nur Kürzel" });
});

test("ensureSingleRoot fasst mehrere oberste Einträge zusammen", () => {
  const { units } = parseOutline("A\nB\n  B1", ids());
  const out = ensureSingleRoot(units, "Organisation", () => "u_root000000");
  assert.equal(out.filter((u) => u.parentId === null).length, 1);
  assert.equal(out[0]!.name, "Organisation");
  const single = parseOutline("A\n  B", ids()).units;
  assert.equal(ensureSingleRoot(single, "x"), single);
});

test("Roundtrip toOutline → parseOutline", () => {
  const doc = sampleDoc();
  const text = toOutline(doc);
  assert.ok(
    text.startsWith("BL | Behördenleitung\n  Stab\n  Abt 1 | Abteilung 1\n    Ref 1.1 | Referat 1.1"),
  );
  const back = parseOutline(text, ids()).units;
  assert.equal(back.length, doc.units.length);
  assert.deepEqual(
    back.map((u) => u.name),
    doc.units.map((u) => u.name),
  );
  assert.ok(toOutline(doc, "u_abt1000001").startsWith("Abt 1 | Abteilung 1\n  Ref 1.1"));
});
