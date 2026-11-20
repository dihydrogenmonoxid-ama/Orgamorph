// Neuer UI-Text = Schlüssel in de.json UND en.json; jeder statisch verwendete Schlüssel existiert.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = "", out: string[] = []): string[] => {
  for (const [k, v] of Object.entries(t)) {
    const key = p ? `${p}.${k}` : k;
    if (typeof v === "string") out.push(key);
    else flat(v, key, out);
  }
  return out;
};
const load = (l: string) =>
  JSON.parse(readFileSync(new URL(`../../src/i18n/${l}.json`, import.meta.url), "utf8"));

test("de.json und en.json haben dieselben Schlüssel", () => {
  assert.deepEqual(flat(load("en")).sort(), flat(load("de")).sort());
});

test("alle statisch verwendeten Schlüssel existieren", () => {
  const keys = new Set(flat(load("de")));
  const root = new URL("../../src/", import.meta.url).pathname;
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(root);
  const missing: string[] = [];
  for (const f of files)
    for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g))
      if (!keys.has(m[1]!)) missing.push(`${f.replace(root, "")}: ${m[1]}`);
  assert.deepEqual(missing, []);
});
