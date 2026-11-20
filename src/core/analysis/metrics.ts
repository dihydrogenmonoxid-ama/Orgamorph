// Kennwerte, bezogen auf den aktuellen Filter. Wertfrei: Hinweise, keine Fehler.

import type { FilteredGraph } from "../filter.ts";
import { collaborationEdges, lineEdges, nodeIds, relationEdges } from "../graph.ts";
import type { Id, OrgUnit } from "../model.ts";

export interface SpanStats {
  min: number;
  median: number;
  max: number;
  /** OEs mit mehr direkt unterstellten OEs als `spanOfControlHint` */
  aboveHint: { unitId: Id; span: number }[];
}

export interface InterfacePair {
  a: Id;
  b: Id;
  /** Projekte/Themen, die beide verbinden */
  topicIds: Id[];
  /** Beziehungen zwischen beiden */
  relationIds: Id[];
}

export interface Metrics {
  unitCount: number;
  /** Anzahl Ebenen unterhalb der Fokus-Wurzel (Wurzel allein = 0) */
  depth: number;
  widthPerLevel: number[];
  spanOfControl: Map<Id, number>;
  span: SpanStats | null;
  topicsPerUnit: Map<Id, number>;
  unitsPerTopic: Map<Id, number>;
  interfaces: InterfacePair[];
  interfacesPerUnit: Map<Id, number>;
  topByParticipation: { unitId: Id; count: number }[];
  topByInterfaces: { unitId: Id; count: number }[];
  /** 0 = reiner Baum, 1 = jeder mit jedem */
  meshedness: number;
  components: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Bereich einer OE: Vorfahre direkt unterhalb der Fokus-Wurzel (bzw. die Wurzel selbst). */
export function areaOf(g: FilteredGraph, unitId: Id): Id {
  const byId = new Map(g.units.map((u) => [u.id, u]));
  let cur = byId.get(unitId);
  if (!cur || cur.id === g.rootId) return g.rootId;
  while (cur && cur.parentId !== g.rootId) {
    const parent: OrgUnit | undefined = cur.parentId ? byId.get(cur.parentId) : undefined;
    if (!parent) break;
    cur = parent;
  }
  return cur?.id ?? unitId;
}

function topN(m: Map<Id, number>, n: number, order: Id[]): { unitId: Id; count: number }[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...m.entries()]
    .filter(([, c]) => c > 0)
    .sort((x, y) => y[1] - x[1] || (pos.get(x[0]) ?? 0) - (pos.get(y[0]) ?? 0))
    .slice(0, n)
    .map(([unitId, count]) => ({ unitId, count }));
}

/** Zusammenhangskomponenten (Union-Find). */
function countComponents(nodes: string[], edges: [string, string][]): number {
  const parent = new Map(nodes.map((n) => [n, n]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  for (const [a, b] of edges) {
    if (!parent.has(a) || !parent.has(b)) continue;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  return new Set(nodes.map(find)).size;
}

/** Vermaschungsgrad (E − (n − k)) / (n(n−1)/2 − (n − k)). */
export function meshedness(n: number, e: number, k: number): number {
  const denom = (n * (n - 1)) / 2 - (n - k);
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(1, (e - (n - k)) / denom));
}

export function computeMetrics(g: FilteredGraph, spanOfControlHint: number): Metrics {
  const ids = g.units.map((u) => u.id);
  const inFocus = g.unitIds;

  // Tiefe und Breite je Ebene
  const level = new Map<Id, number>([[g.rootId, 0]]);
  for (const u of g.units)
    if (u.id !== g.rootId && u.parentId) level.set(u.id, (level.get(u.parentId) ?? 0) + 1);
  const widthPerLevel: number[] = [];
  for (const l of level.values()) widthPerLevel[l] = (widthPerLevel[l] ?? 0) + 1;
  const depth = Math.max(0, widthPerLevel.length - 1);

  // Leitungsspanne
  const spanOfControl = new Map<Id, number>();
  for (const u of g.units)
    if (u.id !== g.rootId && u.parentId && inFocus.has(u.parentId))
      spanOfControl.set(u.parentId, (spanOfControl.get(u.parentId) ?? 0) + 1);
  const spans = [...spanOfControl.values()];
  const span: SpanStats | null = spans.length
    ? {
        min: Math.min(...spans),
        median: median(spans),
        max: Math.max(...spans),
        aboveHint: [...spanOfControl.entries()]
          .filter(([, s]) => s > spanOfControlHint)
          .map(([unitId, s]) => ({ unitId, span: s })),
      }
    : null;

  // Projekte je OE / OEs je Projekt (nur OEs im Fokus)
  const topicsPerUnit = new Map<Id, number>(ids.map((id) => [id, 0]));
  const unitsPerTopic = new Map<Id, number>();
  for (const t of g.topics) {
    const members = t.participants.map((p) => p.unitId).filter((id) => inFocus.has(id));
    unitsPerTopic.set(t.id, new Set(members).size);
    for (const id of new Set(members)) topicsPerUnit.set(id, (topicsPerUnit.get(id) ?? 0) + 1);
  }

  // Schnittstellen: OE-Paare aus verschiedenen Bereichen, verbunden durch Projekt oder Beziehung
  const area = new Map(ids.map((id) => [id, areaOf(g, id)]));
  const pairs = new Map<string, InterfacePair>();
  const touch = (a: Id, b: Id): InterfacePair | undefined => {
    if (a === b || !inFocus.has(a) || !inFocus.has(b) || area.get(a) === area.get(b)) return undefined;
    const [x, y] = a < b ? [a, b] : [b, a];
    const k = `${x}|${y}`;
    let p = pairs.get(k);
    if (!p) {
      p = { a: x, b: y, topicIds: [], relationIds: [] };
      pairs.set(k, p);
    }
    return p;
  };
  for (const t of g.topics) {
    const members = [...new Set(t.participants.map((p) => p.unitId))];
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const p = touch(members[i]!, members[j]!);
        if (p && !p.topicIds.includes(t.id)) p.topicIds.push(t.id);
      }
  }
  for (const r of g.relations) {
    const p = touch(r.from, r.to);
    if (p) p.relationIds.push(r.id);
  }
  const interfaces = [...pairs.values()];
  const interfacesPerUnit = new Map<Id, number>(ids.map((id) => [id, 0]));
  for (const p of interfaces) {
    interfacesPerUnit.set(p.a, (interfacesPerUnit.get(p.a) ?? 0) + 1);
    interfacesPerUnit.set(p.b, (interfacesPerUnit.get(p.b) ?? 0) + 1);
  }

  // Vermaschungsgrad über Fokus-OEs: Linie ∪ Zusammenarbeit ∪ Beziehungen (ungerichtet, verschieden)
  const nodes = nodeIds(g).filter((id) => inFocus.has(id));
  const edgeSet = new Map<string, [string, string]>();
  const addEdge = (a: string, b: string) => {
    if (a === b || !inFocus.has(a) || !inFocus.has(b)) return;
    edgeSet.set(a < b ? `${a}|${b}` : `${b}|${a}`, [a, b]);
  };
  for (const e of lineEdges(g)) addEdge(e.parent, e.child);
  for (const e of collaborationEdges(g)) addEdge(e.a, e.b);
  for (const e of relationEdges(g)) addEdge(e.from, e.to);
  const edges = [...edgeSet.values()];
  const components = countComponents(nodes, edges);

  return {
    unitCount: ids.length,
    depth,
    widthPerLevel,
    spanOfControl,
    span,
    topicsPerUnit,
    unitsPerTopic,
    interfaces,
    interfacesPerUnit,
    topByParticipation: topN(topicsPerUnit, 10, ids),
    topByInterfaces: topN(interfacesPerUnit, 10, ids),
    meshedness: meshedness(nodes.length, edges.length, components),
    components,
  };
}
