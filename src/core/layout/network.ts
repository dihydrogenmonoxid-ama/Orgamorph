// Netz-Sicht: kraftbasiert mit d3-force, fester Seed (gleiche Daten → gleiches Bild).
// Zusammenarbeit zieht stärker: Federkraft ∝ Anzahl gemeinsamer Projekte.

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import type { FilteredGraph } from "../filter.ts";
import { collaborationEdges, connectionCounts, lineEdges, nodeIds, relationEdges } from "../graph.ts";
import type { Id } from "../model.ts";
import { trim } from "./balloon.ts";
import { boundsOf, type Layout, type LayoutEdge, type NodeBox } from "./types.ts";

export const NETWORK = {
  ticks: 300,
  minRadius: 7,
  radiusPerConnection: 3.2,
  charge: -260,
  lineDistance: 70,
  collabDistance: 55,
  relationDistance: 80,
} as const;

/** Mulberry32: kleiner deterministischer Zufallsgenerator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function networkRadius(connections: number): number {
  return Math.round((NETWORK.minRadius + NETWORK.radiusPerConnection * Math.sqrt(connections)) * 10) / 10;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
}

export function layoutNetwork(
  g: FilteredGraph,
  opts: { seed: string; pinned?: Readonly<Record<Id, { x: number; y: number }>>; ticks?: number } = {
    seed: "",
  },
): Layout {
  const ids = nodeIds(g);
  const counts = connectionCounts(g);
  const pinned = opts.pinned ?? {};
  const simNodes: SimNode[] = ids.map((id) => {
    const n: SimNode = { id, r: networkRadius(counts.get(id) ?? 0) };
    const p = pinned[id];
    if (p) {
      n.x = p.x;
      n.y = p.y;
      n.fx = p.x;
      n.fy = p.y;
    }
    return n;
  });

  interface SimLink {
    source: string;
    target: string;
    distance: number;
    strength: number;
  }
  const links: SimLink[] = [];
  for (const e of lineEdges(g))
    links.push({ source: e.parent, target: e.child, distance: NETWORK.lineDistance, strength: 0.25 });
  for (const e of collaborationEdges(g))
    links.push({
      source: e.a,
      target: e.b,
      distance: NETWORK.collabDistance / Math.sqrt(e.weight),
      strength: Math.min(1, 0.3 + 0.2 * e.weight),
    });
  for (const e of relationEdges(g))
    links.push({ source: e.from, target: e.to, distance: NETWORK.relationDistance, strength: 0.3 });

  const sim = forceSimulation<SimNode>(simNodes)
    .randomSource(mulberry32(hashString(opts.seed)))
    .force(
      "link",
      forceLink<SimNode, SimLink & SimulationNodeDatum>(links as never)
        .id((d) => d.id)
        .distance((l) => (l as unknown as SimLink).distance)
        .strength((l) => (l as unknown as SimLink).strength),
    )
    .force("charge", forceManyBody<SimNode>().strength(NETWORK.charge).distanceMax(600))
    .force(
      "collide",
      forceCollide<SimNode>((d) => d.r + 6),
    )
    .force("center", forceCenter(0, 0))
    .stop();
  const ticks = opts.ticks ?? NETWORK.ticks;
  for (let i = 0; i < ticks; i++) sim.tick();

  const nodes = new Map<string, NodeBox>();
  for (const n of simNodes) {
    const x = Math.round((n.x ?? 0) * 10) / 10;
    const y = Math.round((n.y ?? 0) * 10) / 10;
    nodes.set(n.id, { id: n.id, cx: x, cy: y, w: 2 * n.r, h: 2 * n.r, rx: n.r });
  }
  const edges: LayoutEdge[] = lineEdges(g).map((e) => {
    const p = nodes.get(e.parent)!;
    const c = nodes.get(e.child)!;
    return { id: `l:${e.child}`, from: e.parent, to: e.child, points: [trim(p, c), trim(c, p)] };
  });
  return { nodes, edges, bounds: boundsOf(nodes.values(), edges) };
}

/**
 * Wie layoutNetwork, aber mit Zwischenspeicher über die Graphstruktur (Knoten, Kanten, Gewichte, Pins).
 * Textänderungen (Namen, Notizen) lösen so keine neue Simulation aus.
 */
const cache = new Map<string, Layout>();
const CACHE_SIZE = 4;

export function structureKey(
  g: FilteredGraph,
  seed: string,
  pinned: Readonly<Record<Id, { x: number; y: number }>> = {},
): string {
  const parts = [
    seed,
    nodeIds(g).join(","),
    lineEdges(g)
      .map((e) => `${e.parent}>${e.child}`)
      .join(","),
    collaborationEdges(g)
      .map((e) => `${e.a}~${e.b}:${e.weight}`)
      .join(","),
    relationEdges(g)
      .map((e) => `${e.from}-${e.to}`)
      .join(","),
    Object.entries(pinned)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, p]) => `${k}@${p.x},${p.y}`)
      .join(","),
  ];
  return parts.join("|");
}

export function layoutNetworkCached(
  g: FilteredGraph,
  opts: { seed: string; pinned?: Readonly<Record<Id, { x: number; y: number }>> },
): Layout {
  const key = structureKey(g, opts.seed, opts.pinned);
  const hit = cache.get(key);
  if (hit) return hit;
  const l = layoutNetwork(g, opts);
  cache.set(key, l);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return l;
}
