import assert from "node:assert/strict";
import { test } from "node:test";
import { areaOf, computeMetrics, median, meshedness } from "../../../src/core/analysis/metrics.ts";
import { applyFilter } from "../../../src/core/filter.ts";
import { defaultView } from "../../../src/core/model.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

test("Grundkennwerte: Anzahl, Tiefe, Breite, Leitungsspanne", () => {
  const m = computeMetrics(applyFilter(sampleDoc()), 7);
  assert.equal(m.unitCount, 9);
  assert.equal(m.depth, 2);
  assert.deepEqual(m.widthPerLevel, [1, 3, 5]);
  assert.deepEqual(m.span && { min: m.span.min, median: m.span.median, max: m.span.max }, {
    min: 2,
    median: 3,
    max: 3,
  });
  assert.deepEqual(m.span?.aboveHint, []);
  const m2 = computeMetrics(applyFilter(sampleDoc()), 2);
  assert.deepEqual(m2.span?.aboveHint.map((x) => x.unitId).sort(), ["u_abt1000001", "u_root000001"]);
});

test("Projekte je OE, OEs je Projekt, Top-Listen", () => {
  const m = computeMetrics(applyFilter(sampleDoc()), 7);
  assert.equal(m.topicsPerUnit.get("u_ref1100001"), 2);
  assert.equal(m.topicsPerUnit.get("u_root000001"), 0);
  assert.equal(m.unitsPerTopic.get("t_digital001"), 3);
  assert.deepEqual(
    m.topByParticipation.slice(0, 2).map((x) => x.unitId),
    ["u_ref1100001", "u_ref2100001"],
  );
  assert.equal(m.topByInterfaces[0]!.unitId, "u_stab000001");
  assert.equal(m.topByInterfaces[0]!.count, 3);
});

test("Schnittstellen: Paare aus verschiedenen Bereichen", () => {
  const m = computeMetrics(applyFilter(sampleDoc()), 7);
  assert.equal(m.interfaces.length, 6);
  const p = m.interfaces.find((x) => x.a === "u_ref1100001" && x.b === "u_ref2100001")!;
  assert.deepEqual(p.topicIds, ["t_digital001", "t_haushalt01"]);
  const rel = m.interfaces.find((x) => x.relationIds.includes("r_rel0000001"))!;
  assert.deepEqual([rel.a, rel.b].sort(), ["u_abt2000001", "u_ref1300001"]);
});

test("Schnittstellen im Fokus: Bereiche sind die Kinder der Fokus-OE", () => {
  const doc = sampleDoc();
  doc.topics[2]!.participants.push({ unitId: "u_ref1300001", role: "member" });
  const g = applyFilter(doc, { ...defaultView().filter, focusUnitId: "u_abt1000001" });
  assert.equal(areaOf(g, "u_ref1200001"), "u_ref1200001");
  assert.equal(areaOf(g, "u_abt1000001"), "u_abt1000001");
  const m = computeMetrics(g, 7);
  assert.deepEqual(
    m.interfaces.map((x) => [x.a, x.b]),
    [["u_ref1200001", "u_ref1300001"]],
  );
});

test("Vermaschungsgrad", () => {
  const m = computeMetrics(applyFilter(sampleDoc()), 7);
  assert.equal(m.components, 1);
  assert.ok(Math.abs(m.meshedness - 6 / 28) < 1e-12);
  assert.equal(meshedness(4, 3, 1), 0, "Baum");
  assert.equal(meshedness(4, 6, 1), 1, "vollständig");
  assert.equal(meshedness(1, 0, 1), 0);
  assert.equal(meshedness(2, 1, 1), 0);
});

test("Median", () => {
  assert.equal(median([]), 0);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test("einzelne OE: keine Leitungsspanne", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc, { ...defaultView().filter, focusUnitId: "u_ref2200001" });
  const m = computeMetrics(g, 7);
  assert.equal(m.unitCount, 1);
  assert.equal(m.span, null);
  assert.equal(m.depth, 0);
  assert.equal(m.meshedness, 0);
});
