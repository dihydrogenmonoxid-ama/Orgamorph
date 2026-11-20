// Projektionen des gefilterten Teilgraphen: Linie, Zusammenarbeit, Beziehungen.

import type { FilteredGraph } from "./filter.ts";
import type { RelationKind } from "./model.ts";

export interface LineEdge {
  parent: string;
  child: string;
}

export interface CollaborationEdge {
  a: string;
  b: string;
  /** Anzahl gemeinsamer Projekte/Themen (im Filter) */
  weight: number;
  topicIds: string[];
}

export interface RelationEdge {
  id: string;
  from: string;
  to: string;
  kind: RelationKind;
}

export function lineEdges(g: FilteredGraph): LineEdge[] {
  return g.units
    .filter((u) => u.parentId !== null && g.unitIds.has(u.parentId) && u.id !== g.rootId)
    .map((u) => ({ parent: u.parentId!, child: u.id }));
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Kanten zwischen Knoten mit gemeinsamen Projekten; Gewicht = Anzahl gemeinsamer Projekte. */
export function collaborationEdges(g: FilteredGraph): CollaborationEdge[] {
  const m = new Map<string, CollaborationEdge>();
  for (const t of g.topics) {
    const ids = t.nodeIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const k = pairKey(a, b);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const e = m.get(k) ?? { a: lo, b: hi, weight: 0, topicIds: [] };
        if (!e.topicIds.includes(t.id)) {
          e.topicIds.push(t.id);
          e.weight++;
        }
        m.set(k, e);
      }
    }
  }
  return [...m.values()].sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : 1));
}

export function relationEdges(g: FilteredGraph): RelationEdge[] {
  return g.relations.map((r) => ({ id: r.id, from: r.fromNode, to: r.toNode, kind: r.kind }));
}

/** Alle Knoten-IDs: OEs im Fokus, dann Außengruppen. */
export function nodeIds(g: FilteredGraph): string[] {
  return [...g.units.map((u) => u.id), ...g.external.map((x) => x.id)];
}

/** Anzahl Verbindungen je Knoten (Projekte + Beziehungen), für die Knotengröße in der Netz-Sicht. */
export function connectionCounts(g: FilteredGraph): Map<string, number> {
  const c = new Map<string, number>(nodeIds(g).map((id) => [id, 0]));
  for (const t of g.topics) for (const n of t.nodeIds) c.set(n, (c.get(n) ?? 0) + 1);
  for (const r of g.relations) {
    c.set(r.fromNode, (c.get(r.fromNode) ?? 0) + 1);
    c.set(r.toNode, (c.get(r.toNode) ?? 0) + 1);
  }
  return c;
}

/** Ungerichtete Nachbarschaft über alle Kantenarten. */
export function adjacency(g: FilteredGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>(nodeIds(g).map((id) => [id, new Set<string>()]));
  const link = (a: string, b: string) => {
    if (a === b) return;
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  };
  for (const e of lineEdges(g)) link(e.parent, e.child);
  for (const e of collaborationEdges(g)) link(e.a, e.b);
  for (const e of relationEdges(g)) link(e.from, e.to);
  return adj;
}

/** Lokaler Graph: Knoten bis Tiefe `depth` um `center`. */
export function neighbourhood(adj: Map<string, Set<string>>, center: string, depth: 1 | 2): Set<string> {
  const out = new Set<string>([center]);
  let frontier = [center];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const n of frontier)
      for (const m of adj.get(n) ?? [])
        if (!out.has(m)) {
          out.add(m);
          next.push(m);
        }
    frontier = next;
  }
  return out;
}

/** Minimaler Spannbaum (Prim, euklidisch) über Punkte; Rückgabe: Indexpaare. */
export function minimumSpanningTree(points: readonly { x: number; y: number }[]): [number, number][] {
  const n = points.length;
  if (n < 2) return [];
  const inTree = new Array<boolean>(n).fill(false);
  const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const from = new Array<number>(n).fill(-1);
  dist[0] = 0;
  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let best = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (best < 0 || dist[i]! < dist[best]!)) best = i;
    inTree[best] = true;
    if (from[best]! >= 0) edges.push([from[best]!, best]);
    const p = points[best]!;
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue;
      const q = points[i]!;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < dist[i]!) {
        dist[i] = d;
        from[i] = best;
      }
    }
  }
  return edges;
}
