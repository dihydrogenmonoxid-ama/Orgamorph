import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilter, effectiveFocus } from "../../src/core/filter.ts";
import {
  adjacency,
  collaborationEdges,
  connectionCounts,
  lineEdges,
  minimumSpanningTree,
  neighbourhood,
  nodeIds,
  relationEdges,
} from "../../src/core/graph.ts";
import { defaultView, type Filter } from "../../src/core/model.ts";
import { sampleDoc } from "../fixtures/sample.ts";

const f = (patch: Partial<Filter>): Filter => ({ ...defaultView().filter, ...patch });

test("ohne Filter: alle OEs, alle Projekte, alle Beziehungen", () => {
  const g = applyFilter(sampleDoc());
  assert.equal(g.units.length, 9);
  assert.equal(g.rootId, "u_root000001");
  assert.equal(g.topics.length, 3);
  assert.equal(g.relations.length, 2);
  assert.deepEqual(g.external, []);
});

test("Stichtag blendet beendete Projekte aus", () => {
  const g = applyFilter(sampleDoc(), f({ date: "2026-06-01" }));
  assert.deepEqual(
    g.topics.map((t) => t.id),
    ["t_digital001", "t_haushalt01"],
  );
  const g2 = applyFilter(sampleDoc(), f({ date: "2024-06-01" }));
  assert.deepEqual(
    g2.topics.map((t) => t.id),
    ["t_haushalt01", "t_alt0000001"],
  );
});

test("Typen, ausgeblendete Projekte, Beziehungsarten", () => {
  const doc = sampleDoc();
  assert.deepEqual(
    applyFilter(doc, f({ topicTypes: ["workingGroup"] })).topics.map((t) => t.id),
    ["t_haushalt01"],
  );
  assert.equal(applyFilter(doc, f({ hiddenTopics: ["t_digital001", "t_gibtsnicht"] })).topics.length, 2);
  assert.deepEqual(
    applyFilter(doc, f({ relationKinds: ["informs"] })).relations.map((r) => r.id),
    ["r_rel0000002"],
  );
  assert.equal(applyFilter(doc, f({ relationKinds: [] })).relations.length, 0);
});

test("Fokus: nur Teilbaum; Projekte nur mit Beteiligten im Fokus", () => {
  const g = applyFilter(sampleDoc(), f({ focusUnitId: "u_abt1000001" }));
  assert.deepEqual(
    g.units.map((u) => u.id),
    ["u_abt1000001", "u_ref1100001", "u_ref1200001", "u_ref1300001"],
  );
  assert.equal(g.rootId, "u_abt1000001");
  assert.deepEqual(
    g.topics.map((t) => [t.id, t.nodeIds]),
    [
      ["t_digital001", ["u_ref1100001"]],
      ["t_haushalt01", ["u_ref1100001"]],
      ["t_alt0000001", ["u_ref1200001"]],
    ],
  );
  assert.equal(g.relations.length, 0, "Beziehungen nach außen ohne Außenkontakte entfallen");
  assert.equal(g.nodeOf("u_ref2100001"), undefined);
});

test("Außenkontakte: gebündelt nach oberster Ebene", () => {
  const g = applyFilter(sampleDoc(), f({ focusUnitId: "u_abt1000001", showExternal: true }));
  assert.deepEqual(g.external, [
    { id: "x:u_stab000001", anchorId: "u_stab000001", memberIds: ["u_stab000001"] },
    {
      id: "x:u_abt2000001",
      anchorId: "u_abt2000001",
      memberIds: ["u_abt2000001", "u_ref2100001", "u_ref2200001"],
    },
  ]);
  const digital = g.topics.find((t) => t.id === "t_digital001")!;
  assert.deepEqual(digital.nodeIds, ["u_ref1100001", "x:u_abt2000001", "x:u_stab000001"]);
  assert.deepEqual(
    g.relations.map((r) => [r.fromNode, r.toNode]),
    [
      ["u_ref1300001", "x:u_abt2000001"],
      ["x:u_stab000001", "u_ref1200001"],
    ],
  );
  const noFocus = applyFilter(sampleDoc(), f({ showExternal: true }));
  assert.deepEqual(noFocus.external, [], "ohne Fokus gibt es kein Außen");
});

test("Außenkontakte bei tiefem Fokus: Wurzel bildet eigene Gruppe", () => {
  const doc = sampleDoc();
  doc.relations.push({ id: "r_rel0000003", from: "u_root000001", to: "u_ref1100001", kind: "directs" });
  const g = applyFilter(doc, f({ focusUnitId: "u_ref1100001", showExternal: true }));
  assert.ok(g.external.some((x) => x.id === "x:u_root000001"));
});

test("unbekannter Fokus gilt als kein Fokus", () => {
  const doc = sampleDoc();
  assert.equal(effectiveFocus(doc, f({ focusUnitId: "u_weg0000000" })), null);
  assert.equal(applyFilter(doc, f({ focusUnitId: "u_weg0000000" })).units.length, 9);
});

test("Graph-Projektionen", () => {
  const g = applyFilter(sampleDoc());
  assert.equal(lineEdges(g).length, 8);
  const collab = collaborationEdges(g);
  const w = Object.fromEntries(collab.map((e) => [`${e.a}|${e.b}`, e.weight]));
  assert.equal(w["u_ref1100001|u_ref2100001"], 2, "zwei gemeinsame Projekte");
  assert.equal(w["u_ref1100001|u_stab000001"], 1);
  assert.equal(collab.length, 4);
  assert.equal(relationEdges(g).length, 2);
  const counts = connectionCounts(g);
  assert.equal(counts.get("u_ref1100001"), 2);
  assert.equal(counts.get("u_stab000001"), 2);
  assert.equal(counts.get("u_root000001"), 0);
  assert.equal(nodeIds(g).length, 9);
});

test("Nachbarschaft Tiefe 1 und 2", () => {
  const adj = adjacency(applyFilter(sampleDoc()));
  const n1 = neighbourhood(adj, "u_ref2200001", 1);
  assert.deepEqual([...n1].sort(), ["u_abt2000001", "u_ref1200001", "u_ref2200001"]);
  const n2 = neighbourhood(adj, "u_ref2200001", 2);
  assert.ok(n2.has("u_root000001") && n2.has("u_stab000001") && n2.has("u_abt1000001"));
});

test("minimaler Spannbaum", () => {
  assert.deepEqual(minimumSpanningTree([]), []);
  assert.deepEqual(minimumSpanningTree([{ x: 0, y: 0 }]), []);
  const e = minimumSpanningTree([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 1, y: 0 },
    { x: 11, y: 0 },
  ]);
  assert.equal(e.length, 3);
  const len = e.reduce((s, [a, b]) => s + Math.abs([0, 10, 1, 11][a]! - [0, 10, 1, 11][b]!), 0);
  assert.equal(len, 11);
});

test("restrictGraph: lokaler Graph", async () => {
  const { restrictGraph } = await import("../../src/core/filter.ts");
  const g = applyFilter(sampleDoc());
  const keep = neighbourhood(adjacency(g), "u_ref2200001", 1);
  const r = restrictGraph(g, keep);
  assert.deepEqual(r.units.map((u) => u.id).sort(), ["u_abt2000001", "u_ref1200001", "u_ref2200001"]);
  assert.equal(r.rootId, "u_abt2000001");
  assert.deepEqual(
    r.topics.map((t) => [t.id, t.nodeIds]),
    [["t_alt0000001", ["u_ref1200001", "u_ref2200001"]]],
  );
  assert.equal(r.relations.length, 0);
  assert.equal(r.nodeOf("u_ref1100001"), undefined);
  assert.equal(r.nodeOf("u_ref1200001"), "u_ref1200001");
  assert.equal(lineEdges(r).length, 1);
});
