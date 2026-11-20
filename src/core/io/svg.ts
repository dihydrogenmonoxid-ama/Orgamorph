// Szene (ADR 0003): DOM-freie Beschreibung der Grafik für Bildschirm UND Export.
// buildScene() → Szene; sceneToSvgString() → reines SVG (text, rect, path, circle).

import type { FilteredGraph } from "../filter.ts";
import { collaborationEdges, connectionCounts, minimumSpanningTree } from "../graph.ts";
import { layoutBalloon, nodeRadius, trim } from "../layout/balloon.ts";
import { layoutNetworkCached } from "../layout/network.ts";
import {
  BOX,
  COLORS,
  FONT,
  FONT_STACK,
  type LabelLine,
  LINE_HEIGHT,
  linesHeight,
  linesWidth,
  STROKE,
  topicStyle,
  unitLabelLines,
} from "../layout/style.ts";
import { textWidth, truncate } from "../layout/textMetrics.ts";
import { type BoxSize, layoutTree } from "../layout/tree.ts";
import { boundsOf, type Layout, type NodeBox, type Point, type Rect } from "../layout/types.ts";
import {
  type Id,
  type LabelOptions,
  type OrgDocument,
  type OrgUnit,
  type RelationKind,
  type TopicType,
  unitLabel,
  type ViewMode,
} from "../model.ts";

export interface SceneText {
  text: string;
  /** relativ zum Knotenmittelpunkt; y ist die Grundlinie */
  x: number;
  y: number;
  size: number;
  bold: boolean;
  fill: string;
  anchor: "start" | "middle" | "end";
}

export interface SceneMarker {
  topicId: Id;
  x: number;
  y: number;
  size: number;
  color: string;
  filled: boolean;
  patterned: boolean;
}

export interface SceneNode {
  id: string;
  unitId: Id | null;
  kind: "unit" | "external";
  box: NodeBox;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: string | null;
  texts: SceneText[];
  markers: SceneMarker[];
  /** Klartext-Beschreibung (Tooltip, Screenreader); Datenschutzoptionen sind angewendet */
  title: string;
}

export type ArrowMode = "none" | "end" | "both";

export interface SceneEdge {
  id: string;
  kind: "line" | "collab" | "relation" | "topic";
  d: string;
  from: string;
  to: string;
  stroke: string;
  width: number;
  dash: string | null;
  arrow: ArrowMode;
  opacity: number;
  topicId?: Id;
  relationKind?: RelationKind;
  weight?: number;
}

export interface LegendTopic {
  id: Id;
  title: string;
  type: TopicType;
  color: string;
  dash: string | null;
}

export interface Scene {
  mode: ViewMode;
  nodes: SceneNode[];
  edges: SceneEdge[];
  bounds: Rect;
  minFontPx: number;
  legendTopics: LegendTopic[];
  legendRelations: RelationKind[];
  /** Linien gibt es in jeder Sicht; Zusammenarbeit nur im Netz */
  hasCollaboration: boolean;
}

export interface SceneOptions {
  mode: ViewMode;
  label: LabelOptions;
  tree: { orientation: "top-down" | "left-right"; stackLeaves: boolean };
  pinned?: Readonly<Record<Id, { x: number; y: number }>>;
  /** Beschriftung von Außengruppen, z. B. n => `${n} OE` (sprachabhängig, kommt aus der UI) */
  externalCount: (n: number) => string;
  /** Rollenbezeichnung im Tooltip */
  roleText?: { lead: string; member: string };
}

export const RELATION_STYLE: Record<RelationKind, { dash: string | null; arrow: ArrowMode }> = {
  reportsTo: { dash: "6 4", arrow: "end" },
  directs: { dash: null, arrow: "end" },
  informs: { dash: "2 3", arrow: "end" },
  coordinates: { dash: "8 3 2 3", arrow: "both" },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function pathFrom(points: readonly Point[]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
}

/** Schnittpunkt des Strahls Mittelpunkt → Ziel mit dem Rand eines Rechtecks. */
export function clipToRect(box: NodeBox, toward: Point): Point {
  const dx = toward[0] - box.cx;
  const dy = toward[1] - box.cy;
  if (dx === 0 && dy === 0) return [box.cx, box.cy];
  const sx = dx === 0 ? Number.POSITIVE_INFINITY : box.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Number.POSITIVE_INFINITY : box.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return [box.cx + dx * s, box.cy + dy * s];
}

function clip(box: NodeBox, toward: Point, round: boolean): Point {
  if (round) {
    const other: NodeBox = { id: "", cx: toward[0], cy: toward[1], w: 0, h: 0, rx: 0 };
    return trim(box, other);
  }
  return clipToRect(box, toward);
}

/** Tooltip/Screenreader-Text einer OE (Datenschutzoptionen angewendet). */
export function unitTitle(u: OrgUnit, label: LabelOptions): string {
  const parts = [u.shortName && u.shortName !== u.name ? `${u.shortName} – ${u.name}` : u.name];
  if (u.type) parts.push(u.type);
  const l = u.lead;
  if (l) {
    const lead = [l.title, l.code ? `(${l.code})` : ""].filter(Boolean).join(" ");
    if (lead) parts.push(lead);
    if (label.holder && l.holder) parts.push(l.holder);
    if (label.positionNumber && l.positionNumber) parts.push(l.positionNumber);
  }
  return parts.join(" · ");
}

interface Measured {
  lines: LabelLine[];
  markers: { topicId: Id; color: string; filled: boolean; patterned: boolean }[];
}

function measureUnits(doc: OrgDocument, g: FilteredGraph, label: LabelOptions): Map<Id, Measured> {
  const topicIndex = new Map(doc.topics.map((t, i) => [t.id, i]));
  const out = new Map<Id, Measured>();
  for (const u of g.units) out.set(u.id, { lines: unitLabelLines(u, label), markers: [] });
  for (const t of g.topics) {
    const style = topicStyle(t.color, topicIndex.get(t.id) ?? 0);
    for (const p of t.participants) {
      const m = out.get(p.unitId);
      if (m && !m.markers.some((x) => x.topicId === t.id))
        m.markers.push({
          topicId: t.id,
          color: t.color,
          filled: p.role === "lead",
          patterned: style.dash !== null,
        });
    }
  }
  return out;
}

function markerRows(count: number, innerW: number): number {
  if (!count) return 0;
  const perRow = Math.max(1, Math.floor((innerW + BOX.markerGap) / (BOX.markerSize + BOX.markerGap)));
  return Math.ceil(count / perRow);
}

function markersHeight(rows: number): number {
  return rows ? rows * (BOX.markerSize + BOX.markerGap) + 2 : 0;
}

/** Textzeilen zentriert im Kasten anordnen (Grundlinien relativ zur Mitte). */
function placeLines(
  lines: readonly LabelLine[],
  top: number,
  align: "middle" | "start",
  left = 0,
): SceneText[] {
  const out: SceneText[] = [];
  let y = top;
  for (const l of lines) {
    const lh = l.size * LINE_HEIGHT;
    out.push({
      text: l.text,
      x: align === "middle" ? 0 : left,
      y: r1(y + lh / 2 + l.size * 0.35),
      size: l.size,
      bold: l.bold,
      fill: l.tone === "ink" ? COLORS.ink : COLORS.secondary,
      anchor: align,
    });
    y += lh;
  }
  return out;
}

function placeMarkers(m: Measured["markers"], box: { w: number; h: number }): SceneMarker[] {
  if (!m.length) return [];
  const innerW = box.w - 2 * BOX.padX;
  const step = BOX.markerSize + BOX.markerGap;
  const perRow = Math.max(1, Math.floor((innerW + BOX.markerGap) / step));
  const rows = Math.ceil(m.length / perRow);
  const out: SceneMarker[] = [];
  m.forEach((mk, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, m.length - row * perRow);
    const rowW = inRow * step - BOX.markerGap;
    const col = i % perRow;
    out.push({
      topicId: mk.topicId,
      x: r1(-rowW / 2 + col * step),
      y: r1(box.h / 2 - BOX.padY - (rows - row) * step + BOX.markerGap),
      size: BOX.markerSize,
      color: mk.color,
      filled: mk.filled,
      patterned: mk.patterned,
    });
  });
  return out;
}

export function buildScene(doc: OrgDocument, g: FilteredGraph, opts: SceneOptions): Scene {
  const byId = new Map(doc.units.map((u) => [u.id, u]));
  const measured = measureUnits(doc, g, opts.label);
  const externalLines = new Map<string, LabelLine[]>();
  for (const x of g.external) {
    const anchor = byId.get(x.anchorId);
    externalLines.set(x.id, [
      {
        text: anchor ? unitLabel(anchor) : "?",
        role: "name",
        size: FONT.name,
        bold: true,
        tone: "secondary",
      },
      {
        text: opts.externalCount(x.memberIds.length),
        role: "lead",
        size: FONT.lead,
        bold: false,
        tone: "secondary",
      },
    ]);
  }

  let layout: Layout;
  const isTree = opts.mode === "tree";
  const sizes = new Map<string, BoxSize>();
  if (isTree) {
    // Kastenmaße: Breite und Höhe je Ebene einheitlich (ruhigeres Bild)
    const depth = new Map<Id, number>([[g.rootId, 0]]);
    for (const u of g.units)
      if (u.id !== g.rootId && u.parentId) depth.set(u.id, (depth.get(u.parentId) ?? 0) + 1);
    const natural = new Map<Id, BoxSize>();
    for (const u of g.units) {
      const m = measured.get(u.id)!;
      const w = Math.min(BOX.maxW, Math.max(BOX.minW, linesWidth(m.lines) + 2 * BOX.padX));
      const rows = markerRows(m.markers.length, w - 2 * BOX.padX);
      natural.set(u.id, { w, h: Math.ceil(linesHeight(m.lines) + 2 * BOX.padY + markersHeight(rows)) });
    }
    const levelW = new Map<number, number>();
    const levelH = new Map<number, number>();
    for (const u of g.units) {
      const d = depth.get(u.id) ?? 0;
      const n = natural.get(u.id)!;
      levelW.set(d, Math.max(levelW.get(d) ?? 0, n.w));
    }
    for (const u of g.units) {
      const d = depth.get(u.id) ?? 0;
      const m = measured.get(u.id)!;
      const w = levelW.get(d)!;
      const rows = markerRows(m.markers.length, w - 2 * BOX.padX);
      const h = Math.ceil(linesHeight(m.lines) + 2 * BOX.padY + markersHeight(rows));
      levelH.set(d, Math.max(levelH.get(d) ?? 0, h));
    }
    for (const u of g.units) {
      const d = depth.get(u.id) ?? 0;
      sizes.set(u.id, { w: levelW.get(d)!, h: levelH.get(d)! });
    }
    for (const [id, lines] of externalLines)
      sizes.set(id, {
        w: Math.min(BOX.maxW, Math.max(BOX.minW, linesWidth(lines) + 2 * BOX.padX)),
        h: Math.ceil(linesHeight(lines) + 2 * BOX.padY),
      });
    layout = layoutTree(g, sizes, opts.tree);
  } else if (opts.mode === "star") {
    layout = layoutBalloon(g, () => nodeRadius(1));
  } else {
    layout = layoutNetworkCached(g, { seed: doc.id, pinned: opts.pinned ?? {} });
  }

  const nodes: SceneNode[] = [];
  const counts = opts.mode === "network" ? connectionCounts(g) : null;
  let minFont = Number.POSITIVE_INFINITY;
  const extraBounds: NodeBox[] = [];

  const circleLabel = (text: string, box: NodeBox, fill: string, bold: boolean): SceneText[] => {
    const size = opts.mode === "network" ? FONT.network : FONT.star;
    const inside = textWidth(text, size, bold) <= box.w - 6 && opts.mode === "star";
    if (inside) return [{ text, x: 0, y: r1(size * 0.35), size, bold, fill, anchor: "middle" }];
    const shown = truncate(text, 140, size, bold);
    const y = r1(box.h / 2 + 3 + size);
    extraBounds.push({
      id: "",
      cx: box.cx,
      cy: box.cy + y - size / 2,
      w: textWidth(shown, size, bold),
      h: size * 1.4,
      rx: 0,
    });
    return [{ text: shown, x: 0, y, size, bold, fill, anchor: "middle" }];
  };

  for (const u of g.units) {
    const box = layout.nodes.get(u.id);
    if (!box) continue;
    const m = measured.get(u.id)!;
    const isRoot = u.id === g.rootId;
    let texts: SceneText[];
    let markers: SceneMarker[] = [];
    if (isTree) {
      const mh = markersHeight(markerRows(m.markers.length, box.w - 2 * BOX.padX));
      const contentH = linesHeight(m.lines);
      const top = -box.h / 2 + BOX.padY + (box.h - 2 * BOX.padY - mh - contentH) / 2;
      texts = placeLines(m.lines, top, "middle");
      markers = placeMarkers(m.markers, box);
    } else {
      texts = circleLabel(unitLabel(u), box, COLORS.ink, isRoot);
    }
    nodes.push({
      id: u.id,
      unitId: u.id,
      kind: "unit",
      box,
      fill: COLORS.surface,
      stroke: COLORS.ink,
      strokeWidth: isRoot && !isTree ? 2 : STROKE,
      dash: null,
      texts,
      markers,
      title: unitTitle(u, opts.label) + (counts ? ` · ${counts.get(u.id) ?? 0}` : ""),
    });
  }
  for (const x of g.external) {
    const box = layout.nodes.get(x.id);
    if (!box) continue;
    const lines = externalLines.get(x.id)!;
    const texts = isTree
      ? placeLines(lines, -linesHeight(lines) / 2, "middle")
      : circleLabel(lines[0]!.text, box, COLORS.secondary, false);
    const anchor = byId.get(x.anchorId);
    nodes.push({
      id: x.id,
      unitId: null,
      kind: "external",
      box,
      fill: COLORS.externalFill,
      stroke: COLORS.external,
      strokeWidth: 1,
      dash: "3 2",
      texts,
      markers: [],
      title: `${anchor ? unitLabel(anchor) : ""} · ${opts.externalCount(x.memberIds.length)}: ${x.memberIds
        .map((id) => (byId.get(id) ? unitLabel(byId.get(id)!) : id))
        .join(", ")}`,
    });
  }
  for (const n of nodes) for (const t of n.texts) minFont = Math.min(minFont, t.size);

  // ---------- Kanten ----------
  const edges: SceneEdge[] = [];
  const round = !isTree;
  for (const e of layout.edges) {
    edges.push({
      id: e.id,
      kind: "line",
      d: pathFrom(e.points),
      from: e.from,
      to: e.to,
      stroke: opts.mode === "network" ? COLORS.grid : COLORS.line,
      width: opts.mode === "network" ? 1 : STROKE,
      dash: null,
      arrow: "none",
      opacity: 1,
    });
  }

  const topicIndex = new Map(doc.topics.map((t, i) => [t.id, i]));
  if (opts.mode === "star") {
    g.topics.forEach((t, i) => {
      const style = topicStyle(t.color, topicIndex.get(t.id) ?? 0);
      const boxes = t.nodeIds.map((id) => layout.nodes.get(id)).filter((b): b is NodeBox => !!b);
      const off = ((i % 5) - 2) * 2.5;
      for (const [a, b] of minimumSpanningTree(boxes.map((bx) => ({ x: bx.cx, y: bx.cy })))) {
        const A = boxes[a]!;
        const B = boxes[b]!;
        const dx = B.cx - A.cx;
        const dy = B.cy - A.cy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * off;
        const ny = (dx / len) * off;
        const p = trim(A, B);
        const q = trim(B, A);
        edges.push({
          id: `t:${t.id}:${A.id}:${B.id}`,
          kind: "topic",
          d: pathFrom([
            [p[0] + nx, p[1] + ny],
            [q[0] + nx, q[1] + ny],
          ]),
          from: A.id,
          to: B.id,
          stroke: t.color,
          width: 2.5,
          dash: style.dash,
          arrow: "none",
          opacity: 0.9,
          topicId: t.id,
        });
      }
    });
  }

  if (opts.mode === "network") {
    for (const e of collaborationEdges(g)) {
      const A = layout.nodes.get(e.a);
      const B = layout.nodes.get(e.b);
      if (!A || !B) continue;
      const single = e.topicIds.length === 1 ? doc.topics.find((t) => t.id === e.topicIds[0]) : undefined;
      edges.push({
        id: `c:${e.a}:${e.b}`,
        kind: "collab",
        d: pathFrom([trim(A, B), trim(B, A)]),
        from: e.a,
        to: e.b,
        stroke: single ? single.color : COLORS.ink,
        width: r1(Math.min(9, 1 + 1.5 * e.weight)),
        dash: null,
        arrow: "none",
        opacity: single ? 0.75 : 0.55,
        weight: e.weight,
      });
    }
  }

  for (const r of g.relations) {
    const A = layout.nodes.get(r.fromNode);
    const B = layout.nodes.get(r.toNode);
    if (!A || !B) continue;
    const style = RELATION_STYLE[r.kind];
    const p = clip(A, [B.cx, B.cy], round);
    const q = clip(B, [A.cx, A.cy], round);
    let d: string;
    if (isTree) {
      // leicht gebogen, damit Beziehungen sich von der Linie abheben
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const bend = 0.15;
      d = `M${r1(p[0])} ${r1(p[1])}Q${r1(mx - dy * bend)} ${r1(my + dx * bend)} ${r1(q[0])} ${r1(q[1])}`;
    } else {
      d = pathFrom([p, q]);
    }
    edges.push({
      id: `r:${r.id}`,
      kind: "relation",
      d,
      from: r.fromNode,
      to: r.toNode,
      stroke: COLORS.ink,
      width: 1.25,
      dash: style.dash,
      arrow: style.arrow,
      opacity: 0.85,
      relationKind: r.kind,
    });
  }

  const bounds = boundsOf([...nodes.map((n) => n.box), ...extraBounds], layout.edges, 24);
  const legendTopics: LegendTopic[] = g.topics.map((t) => {
    const s = topicStyle(t.color, topicIndex.get(t.id) ?? 0);
    return { id: t.id, title: t.title, type: t.type, color: t.color, dash: s.dash };
  });
  const kinds = new Set(g.relations.map((r) => r.kind));
  const legendRelations = (["reportsTo", "directs", "informs", "coordinates"] as const).filter((k) =>
    kinds.has(k),
  );

  return {
    mode: opts.mode,
    nodes,
    edges,
    bounds,
    minFontPx: Number.isFinite(minFont) ? minFont : FONT.name,
    legendTopics,
    legendRelations,
    hasCollaboration: opts.mode === "network",
  };
}

// ---------- SVG-String ----------

export function escapeXml(s: string): string {
  return (
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      // In XML 1.0 unzulässige Steuerzeichen entfernen (Tab, LF, CR bleiben)
      .replace(/./gsu, (c) => {
        const code = c.charCodeAt(0);
        return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d ? "" : c;
      })
  );
}

const attr = (name: string, v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : ` ${name}="${escapeXml(String(v))}"`;

export interface SvgStringOptions {
  title?: string;
  description?: string;
  background?: boolean;
  /** Breite/Höhe-Attribute (z. B. "297mm"); ohne Angabe px aus der Viewbox */
  width?: string;
  height?: string;
}

/** Zeichenreihenfolge der Kanten (alle unter den Knoten) */
export const EDGE_ORDER: readonly SceneEdge["kind"][] = ["line", "collab", "topic", "relation"];

export const ARROW_ID = "om-arrow";
export const ARROW_START_ID = "om-arrow-start";

export function markerShapes(m: SceneMarker): string {
  const base = `<rect${attr("x", m.x)}${attr("y", m.y)}${attr("width", m.size)}${attr("height", m.size)}${attr("rx", 1)}${attr(
    "fill",
    m.filled ? m.color : COLORS.surface,
  )}${attr("stroke", m.color)}${attr("stroke-width", 1.5)}/>`;
  if (!m.patterned) return base;
  return `${base}<path${attr("d", `M${m.x} ${r1(m.y + m.size)}L${r1(m.x + m.size)} ${m.y}`)}${attr(
    "stroke",
    m.filled ? COLORS.surface : m.color,
  )}${attr("stroke-width", 1)}/>`;
}

export function sceneToSvgString(scene: Scene, opts: SvgStringOptions = {}): string {
  const b = scene.bounds;
  const vb = `${r1(b.x)} ${r1(b.y)} ${r1(b.w)} ${r1(b.h)}`;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg"${attr("viewBox", vb)}${attr("width", opts.width ?? r1(b.w))}${attr(
      "height",
      opts.height ?? r1(b.h),
    )}${attr("font-family", FONT_STACK)} role="img">`,
  );
  if (opts.title) out.push(`<title>${escapeXml(opts.title)}</title>`);
  if (opts.description) out.push(`<desc>${escapeXml(opts.description)}</desc>`);
  out.push(
    `<defs><marker id="${ARROW_ID}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${COLORS.ink}"/></marker>` +
      `<marker id="${ARROW_START_ID}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10 0L0 5L10 10z" fill="${COLORS.ink}"/></marker></defs>`,
  );
  if (opts.background)
    out.push(
      `<rect${attr("x", r1(b.x))}${attr("y", r1(b.y))}${attr("width", r1(b.w))}${attr("height", r1(b.h))} fill="${COLORS.surface}"/>`,
    );

  const edge = (e: SceneEdge) =>
    `<path${attr("d", e.d)} fill="none"${attr("stroke", e.stroke)}${attr("stroke-width", e.width)}${attr(
      "stroke-dasharray",
      e.dash,
    )}${e.opacity < 1 ? attr("stroke-opacity", e.opacity) : ""}${
      e.arrow !== "none" ? attr("marker-end", `url(#${ARROW_ID})`) : ""
    }${e.arrow === "both" ? attr("marker-start", `url(#${ARROW_START_ID})`) : ""} stroke-linejoin="round"/>`;

  out.push('<g class="edges">');
  for (const kind of EDGE_ORDER) for (const e of scene.edges) if (e.kind === kind) out.push(edge(e));
  out.push("</g>");
  out.push('<g class="nodes">');
  for (const n of scene.nodes) {
    const { box } = n;
    out.push(`<g${attr("transform", `translate(${r1(box.cx)} ${r1(box.cy)})`)}>`);
    out.push(`<title>${escapeXml(n.title)}</title>`);
    out.push(
      `<rect${attr("x", r1(-box.w / 2))}${attr("y", r1(-box.h / 2))}${attr("width", r1(box.w))}${attr("height", r1(box.h))}${attr(
        "rx",
        r1(box.rx),
      )}${attr("fill", n.fill)}${attr("stroke", n.stroke)}${attr("stroke-width", n.strokeWidth)}${attr("stroke-dasharray", n.dash)}/>`,
    );
    for (const m of n.markers) out.push(markerShapes(m));
    for (const t of n.texts)
      out.push(
        `<text${attr("x", t.x)}${attr("y", t.y)}${attr("font-size", t.size)}${t.bold ? ' font-weight="700"' : ""}${attr(
          "fill",
          t.fill,
        )}${attr("text-anchor", t.anchor)}>${escapeXml(t.text)}</text>`,
      );
    out.push("</g>");
  }
  out.push("</g>");
  out.push("</svg>");
  return out.join("");
}
