// Gemeinsame Ausgabe aller Layouts: Knotenrahmen (Mittelpunkt + Größe) und Kanten als Polylinien.

export type Point = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Knoten als abgerundetes Rechteck. Ein Kreis ist w = h = 2r, rx = r (für den Morph). */
export interface NodeBox {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rx: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  points: Point[];
}

export interface Layout {
  nodes: Map<string, NodeBox>;
  /** Linienkanten (Unterstellung) */
  edges: LayoutEdge[];
  bounds: Rect;
}

export function boundsOf(nodes: Iterable<NodeBox>, edges: Iterable<LayoutEdge> = [], pad = 0): Rect {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const n of nodes) {
    x0 = Math.min(x0, n.cx - n.w / 2);
    y0 = Math.min(y0, n.cy - n.h / 2);
    x1 = Math.max(x1, n.cx + n.w / 2);
    y1 = Math.max(y1, n.cy + n.h / 2);
  }
  for (const e of edges)
    for (const [x, y] of e.points) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}
