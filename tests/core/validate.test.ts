import assert from "node:assert/strict";
import { test } from "node:test";
import { canReparent, validate } from "../../src/core/validate.ts";
import { sampleDoc } from "../fixtures/sample.ts";

const codes = (d: ReturnType<typeof sampleDoc>) => validate(d).map((i) => i.code);

test("Beispiel ist gültig (Hinweise erlaubt)", () => {
  assert.deepEqual(
    validate(sampleDoc()).filter((i) => i.severity === "error"),
    [],
  );
});

test("Wurzel: keine / mehrere", () => {
  const d = sampleDoc();
  d.units[0]!.parentId = "u_abt1000001";
  assert.ok(codes(d).includes("noRoot"));
  assert.ok(codes(d).includes("cycle"));
  const d2 = sampleDoc();
  d2.units[2]!.parentId = null;
  assert.ok(codes(d2).includes("multipleRoots"));
});

test("fehlende Eltern, leere Namen, doppelte IDs", () => {
  const d = sampleDoc();
  d.units[3]!.parentId = "u_gibtsnicht";
  d.units[4]!.name = "  ";
  d.units[5]!.id = d.units[6]!.id;
  const c = codes(d);
  assert.ok(c.includes("missingParent"));
  assert.ok(c.includes("emptyName"));
  assert.ok(c.includes("duplicateId"));
});

test("Projekte: fehlende/doppelte Beteiligte, Zeitraum, Datum, Typ", () => {
  const d = sampleDoc();
  d.topics[0]!.participants.push({ unitId: "u_nix0000000", role: "member" });
  d.topics[0]!.participants.push({ unitId: "u_ref1100001", role: "member" });
  d.topics[1]!.period = { from: "2026-05-01", to: "2026-01-01" };
  d.topics[2]!.period = { from: "2026-13-01" };
  (d.topics[2] as { type: string }).type = "quatsch";
  const c = codes(d);
  for (const code of [
    "missingParticipant",
    "duplicateParticipant",
    "invalidPeriod",
    "invalidDate",
    "invalidType",
  ])
    assert.ok(c.includes(code as never), code);
});

test("Beziehungen: fehlendes Ende, Selbstbezug, Art", () => {
  const d = sampleDoc();
  d.relations[0]!.to = "u_nix0000000";
  d.relations[1]!.to = d.relations[1]!.from;
  (d.relations[1] as { kind: string }).kind = "x";
  const c = codes(d);
  assert.ok(c.includes("missingRelationEnd"));
  assert.ok(c.includes("selfRelation"));
  assert.ok(c.includes("invalidType"));
});

test("Hinweise: doppelte Stellennummer, Leitungsspanne — keine Sperre", () => {
  const d = sampleDoc();
  d.units[3]!.lead = { positionNumber: "01.100" };
  d.settings.spanOfControlHint = 2;
  const issues = validate(d);
  const dup = issues.find((i) => i.code === "duplicatePositionNumber")!;
  assert.equal(dup.severity, "hint");
  assert.deepEqual(dup.ids.sort(), ["u_abt1000001", "u_ref1100001"]);
  const span = issues.filter((i) => i.code === "spanOfControl");
  assert.deepEqual(span.map((s) => [s.ids[0], s.value]).sort(), [
    ["u_abt1000001", 3],
    ["u_root000001", 3],
  ]);
  assert.ok(issues.every((i) => i.severity === "hint"));
});

test("canReparent verhindert Zyklen und Wurzelbewegung", () => {
  const d = sampleDoc();
  assert.ok(canReparent(d, "u_ref1100001", "u_abt2000001"));
  assert.ok(!canReparent(d, "u_abt1000001", "u_ref1100001"));
  assert.ok(!canReparent(d, "u_abt1000001", "u_abt1000001"));
  assert.ok(!canReparent(d, "u_root000001", "u_abt1000001"));
  assert.ok(!canReparent(d, "u_abt1000001", "u_nix0000000"));
});
