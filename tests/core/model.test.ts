import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ancestorIds,
  depthOf,
  emptyDocument,
  ID_PATTERN,
  isDescendant,
  isIsoDate,
  newId,
  subtreeIds,
  topicActiveOn,
  unitLabel,
} from "../../src/core/model.ts";
import { validate } from "../../src/core/validate.ts";
import { sampleDoc } from "../fixtures/sample.ts";

test("newId: Präfix + 10 Zeichen [a-z0-9], eindeutig", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const id = newId("u");
    assert.match(id, ID_PATTERN);
    assert.ok(id.startsWith("u_"));
    ids.add(id);
  }
  assert.equal(ids.size, 2000);
});

test("emptyDocument ist gültig und hat genau eine Wurzel", () => {
  const d = emptyDocument();
  assert.equal(d.units.length, 1);
  assert.equal(d.units[0]!.parentId, null);
  assert.deepEqual(validate(d), []);
});

test("Teilbaum, Vorfahren, Tiefe", () => {
  const d = sampleDoc();
  assert.deepEqual(subtreeIds(d, "u_abt1000001"), [
    "u_abt1000001",
    "u_ref1100001",
    "u_ref1200001",
    "u_ref1300001",
  ]);
  assert.deepEqual(ancestorIds(d, "u_ref1100001"), ["u_abt1000001", "u_root000001"]);
  assert.equal(depthOf(d, "u_ref1100001"), 2);
  assert.equal(depthOf(d, "u_root000001"), 0);
  assert.ok(isDescendant(d, "u_ref1100001", "u_root000001"));
  assert.ok(!isDescendant(d, "u_root000001", "u_ref1100001"));
});

test("topicActiveOn: Stichtag inklusive Grenzen, offenes Ende", () => {
  const t = sampleDoc().topics[0]!;
  assert.ok(topicActiveOn(t, null));
  assert.ok(topicActiveOn(t, "2026-01-01"));
  assert.ok(topicActiveOn(t, "2026-12-31"));
  assert.ok(!topicActiveOn(t, "2025-12-31"));
  assert.ok(!topicActiveOn(t, "2027-01-01"));
  const open = sampleDoc().topics[1]!;
  assert.ok(topicActiveOn(open, "1999-01-01"));
});

test("isIsoDate / unitLabel", () => {
  assert.ok(isIsoDate("2026-02-28"));
  assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("26-02-01"));
  assert.ok(!isIsoDate(5));
  assert.equal(unitLabel({ name: "Abteilung 1", shortName: "Abt 1" }), "Abt 1");
  assert.equal(unitLabel({ name: "Abteilung 1", shortName: " " }), "Abteilung 1");
});
