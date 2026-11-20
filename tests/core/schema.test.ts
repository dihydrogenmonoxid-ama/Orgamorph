import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { RELATION_KINDS, TOPIC_TYPES, VIEW_MODES } from "../../src/core/model.ts";

const schema = JSON.parse(
  readFileSync(new URL("../../schema/orgamorph.schema.json", import.meta.url), "utf8"),
);

test("Schema: Aufzählungen stimmen mit dem Modell überein", () => {
  assert.deepEqual(schema.$defs.topic.properties.type.enum, [...TOPIC_TYPES]);
  assert.deepEqual(schema.$defs.relation.properties.kind.enum, [...RELATION_KINDS]);
  assert.deepEqual(schema.$defs.view.properties.mode.enum, [...VIEW_MODES]);
  assert.equal(schema.properties.schemaVersion.const, 1);
});

test("Schema: Beispiele erfüllen Pflichtfelder und ID-Muster", () => {
  const pattern = new RegExp(schema.$defs.unit.properties.id.pattern);
  const dir = new URL("../../examples/", import.meta.url);
  const files = readdirSync(dir).filter((x) => x.endsWith(".orgamorph.json"));
  assert.equal(files.length, 2);
  for (const f of files) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    for (const k of schema.required) assert.ok(k in doc, `${f}: ${k}`);
    for (const u of doc.units) {
      for (const k of schema.$defs.unit.required) assert.ok(k in u, `${f}: unit.${k}`);
      assert.match(u.id, pattern);
    }
    for (const t of doc.topics)
      for (const k of schema.$defs.topic.required) assert.ok(k in t, `${f}: topic.${k}`);
  }
});

test("Schema: Logo-Muster entspricht dem Modell", async () => {
  const { LOGO_PATTERN } = await import("../../src/core/model.ts");
  assert.equal(schema.properties.meta.properties.logo.pattern, LOGO_PATTERN.source);
  assert.equal(schema.properties.meta.properties.logo.maxLength, 400000);
});
