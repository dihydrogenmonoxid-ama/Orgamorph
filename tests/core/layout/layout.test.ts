import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilter } from "../../../src/core/filter.ts";
import { layoutBalloon } from "../../../src/core/layout/balloon.ts";
import { fitToPage, legibilitySuggestions } from "../../../src/core/layout/fit.ts";
import { hashString, layoutNetwork, mulberry32 } from "../../../src/core/layout/network.ts";
import { textWidth, truncate, wrap } from "../../../src/core/layout/textMetrics.ts";
import { layoutTree } from "../../../src/core/layout/tree.ts";
import type { NodeBox } from "../../../src/core/layout/types.ts";
import { defaultView, type OrgDocument } from "../../../src/core/model.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

const sizes = (doc: OrgDocument) => new Map(doc.units.map((u) => [u.id, { w: 120, h: 40 }]));

function overlaps(a: NodeBox, b: NodeBox, gap = 0): boolean {
  return (
    Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + gap - 1e-6 &&
    Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + gap - 1e-6
  );
}
function assertNoOverlap(nodes: Map<string, NodeBox>, gap = 0) {
  const list = [...nodes.values()];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      assert.ok(!overlaps(list[i]!, list[j]!, gap), `Überlappung ${list[i]!.id} / ${list[j]!.id}`);
}

/** Großes Testdokument: Wurzel, 6 Abteilungen à 5–8 Referate à 0–3 Sachgebiete, plus Stabsstellen. */
export function bigDoc(): OrgDocument {
  const doc = sampleDoc();
  doc.units = [{ id: "u_root000001", parentId: null, name: "Leitung" }];
  let n = 0;
  const id = () => `u_${String(++n).padStart(10, "0")}`;
  doc.units.push({ id: "u_staffa0001", parentId: "u_root000001", name: "Stab A", isStaff: true });
  doc.units.push({
    id: "u_staffb0001",
    parentId: "u_root000001",
    name: "Stab B mit langem Namen",
    isStaff: true,
  });
  for (let a = 0; a < 6; a++) {
    const aid = id();
    doc.units.push({ id: aid, parentId: "u_root000001", name: `Abteilung ${a + 1}` });
    for (let r = 0; r < 5 + (a % 4); r++) {
      const rid = id();
      doc.units.push({ id: rid, parentId: aid, name: `Referat ${a + 1}.${r + 1}` });
      for (let s = 0; s < (r + a) % 4; s++)
        doc.units.push({ id: id(), parentId: rid, name: `SG ${a}.${r}.${s}` });
    }
  }
  doc.topics = [];
  doc.relations = [];
  return doc;
}

test("Baum: Wurzel oben mittig, Ebenen nach unten, keine Überlappung", () => {
  const doc = sampleDoc();
  const l = layoutTree(applyFilter(doc), sizes(doc), { orientation: "top-down", stackLeaves: false });
  const root = l.nodes.get("u_root000001")!;
  const abt1 = l.nodes.get("u_abt1000001")!;
  const ref11 = l.nodes.get("u_ref1100001")!;
  assert.ok(abt1.cy > root.cy && ref11.cy > abt1.cy);
  assert.equal(l.nodes.size, 9);
  assertNoOverlap(l.nodes, 4);
  // Stab seitlich zwischen Wurzel und Abteilungsebene
  const stab = l.nodes.get("u_stab000001")!;
  assert.ok(stab.cy > root.cy && stab.cy < abt1.cy);
  assert.ok(Math.abs(stab.cx - root.cx) > 60);
  // Orthogonale Kanten
  for (const e of l.edges)
    for (let i = 1; i < e.points.length; i++) {
      const [a, b] = [e.points[i - 1]!, e.points[i]!];
      assert.ok(a[0] === b[0] || a[1] === b[1], `Kante ${e.id} nicht orthogonal`);
    }
});

test("Baum: großes Organigramm ohne Überlappung (normal, gestapelt, links-rechts)", () => {
  const doc = bigDoc();
  const g = applyFilter(doc);
  for (const opts of [
    { orientation: "top-down", stackLeaves: false },
    { orientation: "top-down", stackLeaves: true },
    { orientation: "left-right", stackLeaves: false },
  ] as const) {
    const l = layoutTree(g, sizes(doc), opts);
    assert.equal(l.nodes.size, doc.units.length);
    assertNoOverlap(l.nodes, 2);
  }
});

test("Gestapelte Blattebene spart Breite", () => {
  const doc = bigDoc();
  const g = applyFilter(doc);
  const flat = layoutTree(g, sizes(doc), { orientation: "top-down", stackLeaves: false });
  const stacked = layoutTree(g, sizes(doc), { orientation: "top-down", stackLeaves: true });
  assert.ok(stacked.bounds.w < flat.bounds.w * 0.8, `${stacked.bounds.w} vs ${flat.bounds.w}`);
  // Gestapelte Kinder stehen untereinander unter dem Elternkasten
  const ref = doc.units.find((u) => u.name === "Referat 1.3")!;
  const kids = doc.units.filter((u) => u.parentId === ref.id).map((u) => stacked.nodes.get(u.id)!);
  assert.ok(kids.length >= 2);
  for (let i = 1; i < kids.length; i++) {
    assert.equal(kids[i]!.cx, kids[0]!.cx);
    assert.ok(kids[i]!.cy > kids[i - 1]!.cy);
  }
});

test("Links-rechts: Ebenen nach rechts", () => {
  const doc = sampleDoc();
  const l = layoutTree(applyFilter(doc), sizes(doc), { orientation: "left-right", stackLeaves: true });
  assert.ok(l.nodes.get("u_abt1000001")!.cx > l.nodes.get("u_root000001")!.cx);
  assert.ok(l.nodes.get("u_ref1100001")!.cx > l.nodes.get("u_abt1000001")!.cx);
});

test("Baum: Außenkontakte am rechten Rand", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc, { ...defaultView().filter, focusUnitId: "u_abt1000001", showExternal: true });
  const s = new Map([
    ...sizes(doc),
    ["x:u_stab000001", { w: 100, h: 30 }],
    ["x:u_abt2000001", { w: 100, h: 30 }],
  ]);
  const l = layoutTree(g, s, { orientation: "top-down", stackLeaves: false });
  const maxUnitX = Math.max(...g.units.map((u) => l.nodes.get(u.id)!.cx + 60));
  assert.ok(l.nodes.get("x:u_abt2000001")!.cx - 50 > maxUnitX);
});

test("Sternnetz: Wurzel im Zentrum, Größe ∝ √Teilbaum, keine Überlappung", () => {
  const doc = bigDoc();
  const l = layoutBalloon(applyFilter(doc));
  const root = l.nodes.get("u_root000001")!;
  assert.deepEqual([root.cx, root.cy], [0, 0]);
  assert.equal(root.w, root.h);
  assert.equal(root.rx, root.w / 2);
  const leaf = [...l.nodes.values()].find((n) => n.id.startsWith("u_0") && n.w === l.nodes.get(n.id)!.w)!;
  assert.ok(root.w > leaf.w);
  const circles = [...l.nodes.values()];
  for (let i = 0; i < circles.length; i++)
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]!;
      const b = circles[j]!;
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      assert.ok(d >= a.w / 2 + b.w / 2 - 1e-6, `Kreise überlappen: ${a.id} / ${b.id}`);
    }
  assert.equal(l.edges.length, doc.units.length - 1);
});

test("Netz: deterministisch, angeheftete Knoten bleiben, Zusammenarbeit zieht zusammen", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc);
  const a = layoutNetwork(g, { seed: doc.id });
  const b = layoutNetwork(g, { seed: doc.id });
  assert.deepEqual([...a.nodes.values()], [...b.nodes.values()]);
  const pinned = layoutNetwork(g, { seed: doc.id, pinned: { u_ref1100001: { x: 300, y: -200 } } });
  const p = pinned.nodes.get("u_ref1100001")!;
  assert.deepEqual([p.cx, p.cy], [300, -200]);
  const dist = (x: string, y: string) => {
    const A = a.nodes.get(x)!;
    const B = a.nodes.get(y)!;
    return Math.hypot(A.cx - B.cx, A.cy - B.cy);
  };
  assert.ok(dist("u_ref1100001", "u_ref2100001") < dist("u_ref1300001", "u_ref2200001"));
  assert.ok(a.nodes.get("u_ref1100001")!.w > a.nodes.get("u_root000001")!.w, "mehr Verbindungen → größer");
});

test("Zufallsgenerator und Hash sind deterministisch", () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
  assert.equal(hashString("abc"), hashString("abc"));
  assert.notEqual(hashString("abc"), hashString("abd"));
});

test("Textmetrik: Breite, Kürzen, Umbruch", () => {
  assert.ok(textWidth("WWW", 10) > textWidth("iii", 10));
  assert.ok(textWidth("Abc", 10, true) > textWidth("Abc", 10));
  assert.equal(truncate("kurz", 200, 10), "kurz");
  const t = truncate("Ein sehr langer Name einer Organisationseinheit", 80, 10);
  assert.ok(t.endsWith("…") && textWidth(t, 10) <= 80);
  assert.deepEqual(wrap("Referat für Grundsatzfragen", 1000, 11, 2), ["Referat für Grundsatzfragen"]);
  const w = wrap("Referat für Grundsatzfragen der Digitalisierung und Organisation", 120, 11, 2);
  assert.equal(w.length, 2);
  assert.ok(w.every((l) => textWidth(l, 11) <= 120));
  assert.ok(w[1]!.endsWith("…"));
  assert.deepEqual(wrap("   ", 100, 11, 2), []);
  assert.deepEqual(wrap("Bau-/Liegenschaftsverwaltung", 90, 11, 2).length, 2);
});

test("Einpassen: Ausrichtung automatisch, Lesbarkeit", () => {
  const wide = fitToPage(
    { contentW: 2000, contentH: 500, minFontPx: 10 },
    { format: "A4", orientation: "auto", marginMm: 10, footerMm: 20 },
  );
  assert.equal(wide.orientation, "landscape");
  assert.equal(wide.pageW, 297);
  assert.ok(wide.drawing.w <= wide.area.w + 1e-9 && wide.drawing.h <= wide.area.h + 1e-9);
  const tall = fitToPage(
    { contentW: 500, contentH: 2000, minFontPx: 10 },
    { format: "A4", orientation: "auto", marginMm: 10, footerMm: 20 },
  );
  assert.equal(tall.orientation, "portrait");
  assert.ok(!wide.legible);
  assert.deepEqual(
    legibilitySuggestions(wide, { stackLeaves: false, hasFocus: false, detailsShown: true, treeView: true }),
    ["useA3", "stackLeaves", "focus", "hideDetails"],
  );
  const small = fitToPage(
    { contentW: 200, contentH: 100, minFontPx: 10 },
    { format: "A3", orientation: "portrait", marginMm: 10, footerMm: 20 },
  );
  assert.ok(small.legible);
  assert.ok(small.scale <= (2 * 25.4) / 96 + 1e-12, "maximal doppelte natürliche Größe");
  assert.deepEqual(
    legibilitySuggestions(small, {
      stackLeaves: false,
      hasFocus: false,
      detailsShown: false,
      treeView: true,
    }),
    [],
  );
  // Schriftgröße in pt: 10 px bei 1 px = 1/96 in → 7,5 pt
  const natural = fitToPage(
    { contentW: 100, contentH: 100, minFontPx: 10 },
    { format: "A3", orientation: "portrait", marginMm: 10, footerMm: 20 },
  );
  assert.ok(natural.minFontPt >= 7.5);
});

test("Netz-Cache: gleiche Struktur → gleiches Layout-Objekt, Namensänderung ohne Neuberechnung", async () => {
  const { layoutNetworkCached, structureKey } = await import("../../../src/core/layout/network.ts");
  const doc = sampleDoc();
  const a = layoutNetworkCached(applyFilter(doc), { seed: doc.id });
  doc.units[3]!.name = "Umbenannt";
  const b = layoutNetworkCached(applyFilter(doc), { seed: doc.id });
  assert.equal(a, b);
  doc.topics[0]!.participants.pop();
  assert.notEqual(structureKey(applyFilter(doc), doc.id), structureKey(applyFilter(sampleDoc()), doc.id));
  const c = layoutNetworkCached(applyFilter(doc), { seed: doc.id });
  assert.notEqual(a, c);
});
