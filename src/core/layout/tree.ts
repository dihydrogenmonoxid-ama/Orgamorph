// Organigramm: Reingold-Tilford über d3-hierarchy mit variablen Kastenbreiten,
// Stabsstellen seitlich, optional gestapelte Blattebene, Ausrichtung oben-unten oder links-rechts.
//
// Gerechnet wird in abstrakten Koordinaten: b = Breite (Geschwisterachse), d = Tiefe (Ebenenachse).
// Für links-rechts werden Kastenmaße und Punkte am Ende vertauscht.

import { tree as d3tree, hierarchy } from "d3-hierarchy";
import type { FilteredGraph } from "../filter.ts";
import type { Id, OrgUnit } from "../model.ts";
import { BOX } from "./style.ts";
import { boundsOf, type Layout, type LayoutEdge, type NodeBox, type Point } from "./types.ts";

export interface BoxSize {
  w: number;
  h: number;
}

export interface TreeOptions {
  orientation: "top-down" | "left-right";
  stackLeaves: boolean;
}

export const TREE_GAP = {
  sibling: 16,
  cousin: 28,
  level: 44,
  staffSide: 18,
  staffRow: 10,
  stackIndent: 14,
  stackRow: 8,
  external: 56,
} as const;

interface Attached {
  id: Id;
  /** Offset des Kastenmittelpunkts relativ zum Mittelpunkt des Elternkastens (abstrakt) */
  db: number;
  dd: number;
  b: number;
  d: number;
}

interface Compound {
  id: Id;
  b: number; // Kastenmaß entlang der Breitenachse
  d: number; // Kastenmaß entlang der Tiefenachse
  half: number; // halbe Breite des Verbunds (symmetrisch)
  depthExtent: number; // Ausdehnung entlang der Tiefe ab Kastenoberkante
  staff: Attached[];
  stacked: Attached[];
  /** x-Position der senkrechten Stapellinie relativ zur Kastenmitte */
  stackLine: number;
  /** Tiefe (relativ zur Oberkante) der Verzweigung zu regulären Kindern */
  regularChildren: Id[];
}

interface HNode {
  id: Id;
  children?: HNode[];
}

export function layoutTree(g: FilteredGraph, sizes: ReadonlyMap<string, BoxSize>, opts: TreeOptions): Layout {
  const lr = opts.orientation === "left-right";
  const stackLeaves = opts.stackLeaves && !lr;
  const sz = (id: string) => {
    const s = sizes.get(id) ?? { w: BOX.minW, h: 32 };
    return lr ? { b: s.h, d: s.w } : { b: s.w, d: s.h };
  };

  const byId = new Map<Id, OrgUnit>(g.units.map((u) => [u.id, u]));
  const kids = new Map<Id, Id[]>();
  for (const u of g.units) {
    if (u.id === g.rootId || !u.parentId || !byId.has(u.parentId)) continue;
    const list = kids.get(u.parentId) ?? [];
    list.push(u.id);
    kids.set(u.parentId, list);
  }
  const childrenOf = (id: Id) => kids.get(id) ?? [];
  const isLeaf = (id: Id) => childrenOf(id).length === 0;

  /** Alle Nachfahren als eingerückte Liste (für Stabsstellen mit Unterstruktur). */
  const descendantsList = (id: Id, level = 1): { id: Id; level: number }[] =>
    childrenOf(id).flatMap((c) => [{ id: c, level }, ...descendantsList(c, level + 1)]);

  // ---------- Verbünde bilden ----------
  const compounds = new Map<Id, Compound>();
  const extraAttached: Attached[] = []; // Unterstruktur von Stabsstellen
  const extraEdges: { from: Id; to: Id; anchor: Id; stackLine: number }[] = [];

  const buildCompound = (id: Id): Compound => {
    const own = sz(id);
    const all = childrenOf(id);
    const staffIds = all.filter((c) => byId.get(c)?.isStaff);
    const regular = all.filter((c) => !byId.get(c)?.isStaff);
    const stack = stackLeaves && regular.length > 0 && regular.every(isLeaf);

    let half = own.b / 2;
    let cursor = own.d + (staffIds.length ? TREE_GAP.staffRow : 0); // ab Oberkante

    // Stabsstellen: abwechselnd rechts/links neben der Verbindungslinie
    const staff: Attached[] = [];
    for (let i = 0; i < staffIds.length; i += 2) {
      const pair = staffIds.slice(i, i + 2);
      let rowDepth = 0;
      pair.forEach((sid, k) => {
        const s = sz(sid);
        const side = k === 0 ? 1 : -1;
        const sub = descendantsList(sid);
        const subDepth = sub.reduce((acc, x) => acc + sz(x.id).d + TREE_GAP.stackRow, 0);
        const db = side * (TREE_GAP.staffSide + s.b / 2);
        const dd = cursor + s.d / 2 - own.d / 2;
        staff.push({ id: sid, db, dd, b: s.b, d: s.d });
        // Unterstruktur der Stabsstelle eingerückt darunter
        let subCursor = cursor + s.d + TREE_GAP.stackRow;
        let subHalf = Math.abs(db) + s.b / 2;
        const line = db - (side * s.b) / 2 + side * 6;
        for (const x of sub) {
          const xs = sz(x.id);
          const left = line + side * (TREE_GAP.stackIndent * x.level - 6);
          const xb = side > 0 ? left + xs.b / 2 : left - xs.b / 2;
          extraAttached.push({ id: x.id, db: xb, dd: subCursor + xs.d / 2 - own.d / 2, b: xs.b, d: xs.d });
          extraEdges.push({ from: byId.get(x.id)!.parentId!, to: x.id, anchor: id, stackLine: line });
          subHalf = Math.max(subHalf, Math.abs(xb) + xs.b / 2);
          subCursor += xs.d + TREE_GAP.stackRow;
        }
        half = Math.max(half, subHalf);
        rowDepth = Math.max(rowDepth, s.d + subDepth);
      });
      cursor += rowDepth + TREE_GAP.staffRow;
    }

    // Gestapelte Blattebene: Spalte unter dem Kasten, Linie links
    const stacked: Attached[] = [];
    let stackLine = 0;
    if (stack) {
      const colB = Math.max(...regular.map((c) => sz(c).b));
      const colLeft = -colB / 2 + TREE_GAP.stackIndent / 2;
      stackLine = colLeft - TREE_GAP.stackIndent / 2 - 4;
      cursor += TREE_GAP.stackRow + 4;
      for (const c of regular) {
        const s = sz(c);
        stacked.push({ id: c, db: colLeft + colB / 2, dd: cursor + s.d / 2 - own.d / 2, b: colB, d: s.d });
        cursor += s.d + TREE_GAP.stackRow;
      }
      cursor -= TREE_GAP.stackRow;
      half = Math.max(half, colLeft + colB, -stackLine + 2);
    }

    return {
      id,
      b: own.b,
      d: own.d,
      half,
      depthExtent: Math.max(own.d, cursor),
      staff,
      stacked,
      stackLine,
      regularChildren: stack ? [] : regular,
    };
  };

  const build = (id: Id): HNode => {
    const c = buildCompound(id);
    compounds.set(id, c);
    const children = c.regularChildren.map(build);
    return children.length ? { id, children } : { id };
  };
  const rootH = hierarchy<HNode>(build(g.rootId));

  // ---------- Reingold-Tilford ----------
  const layout = d3tree<HNode>()
    .nodeSize([1, 1])
    .separation((a, b) => {
      const ca = compounds.get(a.data.id)!;
      const cb = compounds.get(b.data.id)!;
      return ca.half + cb.half + (a.parent === b.parent ? TREE_GAP.sibling : TREE_GAP.cousin);
    });
  const laid = layout(rootH);

  // Ebenen: Oberkanten ausgerichtet, Ebenenhöhe = größter Verbund
  const rowExtent: number[] = [];
  laid.each((n) => {
    const c = compounds.get(n.data.id)!;
    rowExtent[n.depth] = Math.max(rowExtent[n.depth] ?? 0, c.depthExtent);
  });
  const rowTop: number[] = [0];
  for (let k = 1; k < rowExtent.length; k++) rowTop[k] = rowTop[k - 1]! + rowExtent[k - 1]! + TREE_GAP.level;

  // ---------- Knoten ----------
  const abstract = new Map<string, { b: number; d: number; sb: number; sd: number }>(); // Mittelpunkt + Größe
  const edges: { id: string; from: string; to: string; pts: Point[] }[] = [];

  laid.each((n) => {
    const c = compounds.get(n.data.id)!;
    const cb = n.x;
    const top = rowTop[n.depth]!;
    const cd = top + c.d / 2;
    abstract.set(c.id, { b: cb, d: cd, sb: c.b, sd: c.d });
    const bottom = top + c.d;

    for (const s of c.staff) {
      abstract.set(s.id, { b: cb + s.db, d: cd + s.dd, sb: s.b, sd: s.d });
      const innerEdge = cb + s.db - Math.sign(s.db) * (s.b / 2);
      edges.push({
        id: `l:${s.id}`,
        from: c.id,
        to: s.id,
        pts: [
          [cb, bottom],
          [cb, cd + s.dd],
          [innerEdge, cd + s.dd],
        ],
      });
    }
    for (const s of c.stacked) {
      abstract.set(s.id, { b: cb + s.db, d: cd + s.dd, sb: s.b, sd: s.d });
      const lineB = cb + c.stackLine;
      const joint = bottom + TREE_GAP.stackRow / 2;
      edges.push({
        id: `l:${s.id}`,
        from: c.id,
        to: s.id,
        pts: [
          [cb, bottom],
          [cb, joint],
          [lineB, joint],
          [lineB, cd + s.dd],
          [cb + s.db - s.b / 2, cd + s.dd],
        ],
      });
    }
    const base = { b: cb, d: cd };
    for (const a of extraAttached.filter((x) => extraEdges.find((e) => e.to === x.id)?.anchor === c.id))
      abstract.set(a.id, { b: base.b + a.db, d: base.d + a.dd, sb: a.b, sd: a.d });
    for (const e of extraEdges.filter((x) => x.anchor === c.id)) {
      const p = abstract.get(e.from)!;
      const ch = abstract.get(e.to)!;
      const side = Math.sign(ch.b - p.b) || 1;
      const lineB = p.b - (side * p.sb) / 2 + side * 8;
      edges.push({
        id: `l:${e.to}`,
        from: e.from,
        to: e.to,
        pts: [
          [lineB, p.d + p.sd / 2],
          [lineB, ch.d],
          [ch.b - (side * ch.sb) / 2, ch.d],
        ],
      });
    }

    // reguläre Kinder: orthogonal über eine Sammelschiene in der Ebenenlücke
    if (n.children) {
      const busD = rowTop[n.depth + 1]! - TREE_GAP.level / 2;
      for (const child of n.children) {
        const childTop = rowTop[child.depth]!;
        edges.push({
          id: `l:${child.data.id}`,
          from: c.id,
          to: child.data.id,
          pts: [
            [cb, bottom],
            [cb, busD],
            [child.x, busD],
            [child.x, childTop],
          ],
        });
      }
    }
  });

  // ---------- Außenkontakte am Rand ----------
  if (g.external.length) {
    let maxB = Number.NEGATIVE_INFINITY;
    for (const a of abstract.values()) maxB = Math.max(maxB, a.b + a.sb / 2);
    let cursor = 0;
    const extB = Math.max(...g.external.map((x) => sz(x.id).b));
    for (const x of g.external) {
      const s = sz(x.id);
      abstract.set(x.id, { b: maxB + TREE_GAP.external + extB / 2, d: cursor + s.d / 2, sb: s.b, sd: s.d });
      cursor += s.d + TREE_GAP.stackRow;
    }
  }

  // ---------- abstrakt → Bildschirm ----------
  const map = ([b, d]: Point): Point => (lr ? [d, b] : [b, d]);
  const nodes = new Map<string, NodeBox>();
  for (const [id, a] of abstract) {
    const [cx, cy] = map([a.b, a.d]);
    nodes.set(id, { id, cx, cy, w: lr ? a.sd : a.sb, h: lr ? a.sb : a.sd, rx: BOX.radius });
  }
  const outEdges: LayoutEdge[] = edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    points: e.pts.map(map),
  }));
  return { nodes, edges: outEdges, bounds: boundsOf(nodes.values(), outEdges) };
}
