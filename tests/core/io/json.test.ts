import assert from "node:assert/strict";
import { test } from "node:test";
import { ParseError, parse, serialize } from "../../../src/core/io/json.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

test("Roundtrip: parse(serialize(doc)) ergibt dasselbe Dokument", () => {
  const d = sampleDoc();
  const { doc, readOnly, issues } = parse(serialize(d));
  assert.equal(readOnly, false);
  assert.deepEqual(doc, d);
  assert.ok(issues.every((i) => i.severity === "hint"));
});

test("Format: 2 Leerzeichen, \\n am Ende, feste Schlüsselreihenfolge, leere Felder weg", () => {
  const d = sampleDoc();
  d.units[1]!.note = "";
  d.units[1]!.lead = {};
  const s = serialize(d);
  assert.ok(s.endsWith("}\n"));
  assert.ok(s.startsWith('{\n  "format": "orgamorph",\n  "schemaVersion": 1,\n  "id"'));
  const stab = JSON.parse(s).units[1];
  assert.deepEqual(Object.keys(stab), ["id", "parentId", "name", "shortName", "isStaff"]);
  const abt = JSON.parse(s).units[2];
  assert.deepEqual(Object.keys(abt), ["id", "parentId", "name", "shortName", "type", "lead"]);
  assert.deepEqual(Object.keys(abt.lead), ["title", "code", "positionNumber", "holder"]);
  const topic = JSON.parse(s).topics[1];
  assert.deepEqual(topic.period, {});
  assert.deepEqual(JSON.parse(s).view.filter.focusUnitId, null);
  assert.equal(serialize(parse(s).doc), s, "stabil");
});

test("Schlüsselreihenfolge unabhängig von Einfügereihenfolge", () => {
  const d = sampleDoc();
  const u = d.units[3]!;
  d.units[3] = { note: "n", name: u.name, parentId: u.parentId, id: u.id };
  const keys = Object.keys(JSON.parse(serialize(d)).units[3]);
  assert.deepEqual(keys, ["id", "parentId", "name", "note"]);
});

test("unbekannte Felder bleiben erhalten (hinter den bekannten)", () => {
  const raw = JSON.parse(serialize(sampleDoc()));
  raw.extension = { foo: 1 };
  raw.units[0].zFuture = "x";
  const out = JSON.parse(serialize(parse(JSON.stringify(raw)).doc));
  assert.deepEqual(out.extension, { foo: 1 });
  assert.equal(out.units[0].zFuture, "x");
  assert.equal(Object.keys(out.units[0]).at(-1), "zFuture");
});

test("fehlende Blöcke werden ergänzt (Migration)", () => {
  const minimal = {
    format: "orgamorph",
    schemaVersion: 1,
    meta: { title: "x" },
    units: [{ id: "u_root000001", parentId: null, name: "Wurzel" }],
    topics: [{ id: "t_a000000001", title: "T", type: "project", color: "#000000" }],
  };
  const { doc } = parse(JSON.stringify(minimal));
  assert.match(doc.id, /^d_/);
  assert.deepEqual(doc.relations, []);
  assert.equal(doc.view.mode, "tree");
  assert.equal(doc.settings.spanOfControlHint, 7);
  assert.deepEqual(doc.topics[0]!.participants, []);
  assert.deepEqual(doc.topics[0]!.period, {});
  assert.equal(doc.view.label.holder, false);
});

test("höhere schemaVersion → nur lesend", () => {
  const raw = JSON.parse(serialize(sampleDoc()));
  raw.schemaVersion = 2;
  const r = parse(JSON.stringify(raw));
  assert.equal(r.readOnly, true);
  assert.equal(r.doc.schemaVersion, 2);
});

test("Fehlerfälle: kein JSON, falsches Format, ungültig; BOM wird toleriert", () => {
  assert.throws(
    () => parse("{"),
    (e: unknown) => e instanceof ParseError && e.code === "notJson",
  );
  assert.throws(
    () => parse('{"format":"x"}'),
    (e: unknown) => e instanceof ParseError && e.code === "notOrgamorph",
  );
  const raw = JSON.parse(serialize(sampleDoc()));
  raw.units[3].parentId = "u_nix0000000";
  assert.throws(
    () => parse(JSON.stringify(raw)),
    (e: unknown) => e instanceof ParseError && e.code === "invalid",
  );
  assert.ok(parse(`﻿${serialize(sampleDoc())}`).doc);
});
