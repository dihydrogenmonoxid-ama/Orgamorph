// Preact 11 hängt an Zahlen in style={{…}} kein „px“ mehr an. Längenangaben müssen Zeichenketten mit Einheit sein.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("../../src/ui/", import.meta.url);
const LENGTH_KEY =
  /\b(margin\w*|padding\w*|top|left|right|bottom|width|height|max\w+|min\w+|gap|fontSize|borderRadius)\s*:\s*(-?[1-9][\d.]*)\s*[,}]/;

test("keine einheitenlosen Längen in Inline-Styles", () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
      const hit = m[1]!.match(LENGTH_KEY);
      assert.equal(hit, null, `${f}: ${hit?.[0]}`);
    }
  }
});
