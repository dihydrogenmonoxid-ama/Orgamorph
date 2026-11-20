import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { applyFilter } from "../../src/core/filter.ts";
import { parse, serialize } from "../../src/core/io/json.ts";
import { buildScene } from "../../src/core/io/svg.ts";

const dir = new URL("../../examples/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".orgamorph.json"));
const all = readdirSync(dir);

test("zwei Beispieldateien vorhanden", () => assert.equal(files.length, 2));

for (const f of files) {
  test(`Beispiel ${f}: gültig, stabil serialisiert, darstellbar`, () => {
    const text = readFileSync(new URL(f, dir), "utf8");
    const { doc, readOnly, issues } = parse(text);
    assert.equal(readOnly, false);
    assert.deepEqual(
      issues.filter((i) => i.severity === "error"),
      [],
    );
    assert.equal(serialize(doc), text, "Datei entspricht der kanonischen Serialisierung");
    for (const mode of ["tree", "star", "network"] as const) {
      const scene = buildScene(doc, applyFilter(doc), {
        mode,
        label: doc.view.label,
        tree: doc.view.tree,
        externalCount: (n) => `${n}`,
      });
      assert.equal(scene.nodes.length, doc.units.length);
    }
  });
}

test("Beispiel-CSV und Excel-Vorlage liegen bei und entsprechen den Vorlagenfunktionen", async () => {
  const { exampleCsv, templateXlsx } = await import("../../src/core/io/templates.ts");
  assert.ok(all.includes("beispiel-einheiten.csv") && all.includes("vorlage-struktur.xlsx"));
  assert.equal(readFileSync(new URL("beispiel-einheiten.csv", dir), "utf8"), exampleCsv());
  assert.deepEqual(new Uint8Array(readFileSync(new URL("vorlage-struktur.xlsx", dir))), templateXlsx());
});
