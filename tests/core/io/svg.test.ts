import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilter } from "../../../src/core/filter.ts";
import {
  buildScene,
  clipToRect,
  escapeXml,
  type SceneOptions,
  sceneToSvgString,
} from "../../../src/core/io/svg.ts";
import { defaultView, type LabelOptions, type ViewMode } from "../../../src/core/model.ts";
import { sampleDoc } from "../../fixtures/sample.ts";

const opts = (mode: ViewMode, label: Partial<LabelOptions> = {}): SceneOptions => ({
  mode,
  label: { ...defaultView().label, ...label },
  tree: { orientation: "top-down", stackLeaves: false },
  externalCount: (n) => `${n} OE`,
});

test("Szene je Sicht: alle Knoten, Linienkanten, Grenzen", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc);
  for (const mode of ["tree", "star", "network"] as const) {
    const s = buildScene(doc, g, opts(mode));
    assert.equal(s.nodes.length, 9, mode);
    assert.equal(s.edges.filter((e) => e.kind === "line").length, 8, mode);
    assert.equal(s.edges.filter((e) => e.kind === "relation").length, 2, mode);
    assert.ok(s.bounds.w > 0 && s.bounds.h > 0);
    for (const n of s.nodes) {
      assert.ok(
        n.box.cx - n.box.w / 2 >= s.bounds.x && n.box.cx + n.box.w / 2 <= s.bounds.x + s.bounds.w,
        `${mode} ${n.id}`,
      );
    }
  }
});

test("Organigramm: Projektmarker in den Kästen (federführend gefüllt)", () => {
  const doc = sampleDoc();
  const s = buildScene(doc, applyFilter(doc), opts("tree"));
  const ref11 = s.nodes.find((n) => n.id === "u_ref1100001")!;
  assert.deepEqual(
    ref11.markers.map((m) => [m.topicId, m.filled]),
    [
      ["t_digital001", true],
      ["t_haushalt01", false],
    ],
  );
  for (const m of ref11.markers) {
    assert.ok(m.y + m.size <= ref11.box.h / 2 && m.y >= -ref11.box.h / 2, "Marker innerhalb des Kastens");
  }
  assert.equal(s.legendTopics.length, 3);
  assert.deepEqual(s.legendRelations, ["reportsTo", "informs"]);
});

test("Sternnetz: Projekte als Linienzüge (MST), Netz: gewichtete Zusammenarbeit", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc);
  const star = buildScene(doc, g, opts("star"));
  const digital = star.edges.filter((e) => e.topicId === "t_digital001");
  assert.equal(digital.length, 2, "3 Beteiligte → 2 Kanten");
  const net = buildScene(doc, g, opts("network"));
  const collab = net.edges.filter((e) => e.kind === "collab");
  assert.equal(collab.length, 4);
  const heavy = collab.find((e) => e.weight === 2)!;
  const light = collab.find((e) => e.weight === 1)!;
  assert.ok(heavy.width > light.width);
});

test("Abnahme 6: Namen und Stellennummern nur bei eingeschalteter Option", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc);
  for (const mode of ["tree", "star", "network"] as const) {
    const off = sceneToSvgString(buildScene(doc, g, opts(mode)), { title: "x" });
    assert.ok(!off.includes("Max Mustermann"), mode);
    assert.ok(!off.includes("01.100"), mode);
    const on = sceneToSvgString(buildScene(doc, g, opts(mode, { holder: true, positionNumber: true })));
    assert.ok(on.includes("Max Mustermann"), mode);
    assert.ok(on.includes("01.100"), mode);
  }
  const tree = buildScene(doc, g, opts("tree", { holder: true }));
  const abt1 = tree.nodes.find((n) => n.id === "u_abt1000001")!;
  assert.ok(abt1.texts.some((t) => t.text === "Max Mustermann"));
});

test("Beschriftungsoptionen: Kürzel und Funktionskürzel ausblendbar", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc);
  const texts = (l: Partial<LabelOptions>) =>
    buildScene(doc, g, opts("tree", l))
      .nodes.find((n) => n.id === "u_abt1000001")!
      .texts.map((t) => t.text);
  assert.deepEqual(texts({}), ["Abt 1", "Abteilung 1", "Abteilungsleitung (A1)"]);
  assert.deepEqual(texts({ shortNames: false, leadCode: false }), ["Abteilung 1", "Abteilungsleitung"]);
});

test("Außenkontakte erscheinen als graue, gestrichelte Gruppen", () => {
  const doc = sampleDoc();
  const g = applyFilter(doc, { ...defaultView().filter, focusUnitId: "u_abt1000001", showExternal: true });
  for (const mode of ["tree", "star", "network"] as const) {
    const s = buildScene(doc, g, opts(mode));
    const ext = s.nodes.filter((n) => n.kind === "external");
    assert.equal(ext.length, 2, mode);
    assert.ok(ext.every((n) => n.dash && n.unitId === null));
  }
  const tree = buildScene(doc, g, opts("tree"));
  const abt2 = tree.nodes.find((n) => n.id === "x:u_abt2000001")!;
  assert.deepEqual(
    abt2.texts.map((t) => t.text),
    ["Abt 2", "3 OE"],
  );
});

test("SVG-String: gültige Struktur, Escaping, kleinste Schrift", () => {
  const doc = sampleDoc();
  doc.units[3]!.name = `Referat <script>alert("x")</script> & Co`;
  const scene = buildScene(doc, applyFilter(doc), opts("tree"));
  const svg = sceneToSvgString(scene, { title: "Titel & <Test>", background: true });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith("</svg>"));
  assert.ok(!svg.includes("<script"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("Titel &amp; &lt;Test&gt;"));
  assert.ok(!svg.includes("foreignObject"));
  assert.equal(scene.minFontPx, 10);
  assert.equal(escapeXml(`a'b"c\u0001`), "a&apos;b&quot;c");
});

test("clipToRect trifft den Rand", () => {
  const box = { id: "a", cx: 0, cy: 0, w: 100, h: 40, rx: 0 };
  assert.deepEqual(clipToRect(box, [200, 0]), [50, 0]);
  assert.deepEqual(clipToRect(box, [0, -100]), [0, -20]);
  assert.deepEqual(clipToRect(box, [0, 0]), [0, 0]);
});
