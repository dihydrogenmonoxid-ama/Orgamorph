// Sternnetz: Balloon-Layout. Kinder kreisförmig um den Elternknoten,
// Radius nach Teilbaumgröße, rekursiv. Knotengröße ∝ √(Teilbaumgröße).

import type { FilteredGraph } from "../filter.ts";
import type { Id } from "../model.ts";
import { boundsOf, type Layout, type LayoutEdge, type NodeBox } from "./types.ts";

export const BALLOON = {
  baseRadius: 7,
  minRadius: 13,
  gap: 12,
  /** Winkelanteil für Kinder eines Nicht-Wurzelknotens (Rest bleibt zur Elternseite frei) */
  childArc: 1.25 * Math.PI,
  externalRing: 60,
} as const;

/** Radius ∝ √(Teilbaumgröße), mindestens `minRadius` (Platz für das Kürzel). */
export function nodeRadius(subtreeSize: number): number {
  return (
    Math.round(Math.max(BALLOON.minRadius, BALLOON.baseRadius * Math.sqrt(Math.max(1, subtreeSize))) * 10) /
    10
  );
}

export function layoutBalloon(g: FilteredGraph, externalRadius: (id: string) => number = () => 18): Layout {
  const kids = new Map<Id, Id[]>();
  const present = new Set(g.units.map((u) => u.id));
  for (const u of g.units) {
    if (u.id === g.rootId || !u.parentId || !present.has(u.parentId)) continue;
    kids.set(u.parentId, [...(kids.get(u.parentId) ?? []), u.id]);
  }
  const childrenOf = (id: Id) => kids.get(id) ?? [];

  const size = new Map<Id, number>();
  const sizeOf = (id: Id): number => {
    const s = 1 + childrenOf(id).reduce((acc, c) => acc + sizeOf(c), 0);
    size.set(id, s);
    return s;
  };
  sizeOf(g.rootId);

  // Umkreisradius je Teilbaum und Bahnradius der Kinder
  const outer = new Map<Id, number>();
  const orbit = new Map<Id, number>();
  const computeRadii = (id: Id, isRoot: boolean): number => {
    const r = nodeRadius(size.get(id)!);
    const ch = childrenOf(id);
    if (!ch.length) {
      outer.set(id, r);
      return r;
    }
    const childOuter = ch.map((c) => computeRadii(c, false));
    const arc = isRoot ? 2 * Math.PI : BALLOON.childArc;
    // Benötigter Umfang: Summe der Durchmesser + Abstände, verteilt auf den Bogen
    const need = childOuter.reduce((s, x) => s + 2 * x + BALLOON.gap, 0);
    const maxChild = Math.max(...childOuter);
    let o = Math.max(r + maxChild + BALLOON.gap, need / arc);
    // Bei nur einem Kind (Nicht-Wurzel): direkt nach außen
    if (ch.length === 1) o = r + maxChild + BALLOON.gap;
    orbit.set(id, o);
    const R = o + maxChild;
    outer.set(id, R);
    return R;
  };
  computeRadii(g.rootId, true);

  const nodes = new Map<string, NodeBox>();
  const place = (id: Id, cx: number, cy: number, dir: number, isRoot: boolean) => {
    const r = nodeRadius(size.get(id)!);
    nodes.set(id, { id, cx, cy, w: 2 * r, h: 2 * r, rx: r });
    const ch = childrenOf(id);
    if (!ch.length) return;
    const o = orbit.get(id)!;
    const arc = isRoot ? 2 * Math.PI : BALLOON.childArc;
    const weights = ch.map((c) => 2 * outer.get(c)! + BALLOON.gap);
    const total = weights.reduce((s, w) => s + w, 0);
    // Tatsächlich genutzter Bogen (bei großem Bahnradius kleiner als `arc`)
    const used = isRoot ? 2 * Math.PI : Math.min(arc, total / o);
    let angle = isRoot ? -Math.PI / 2 : dir - used / 2;
    ch.forEach((c, i) => {
      const span = (weights[i]! / total) * used;
      const a = angle + span / 2;
      place(c, cx + o * Math.cos(a), cy + o * Math.sin(a), a, false);
      angle += span;
    });
  };
  place(g.rootId, 0, 0, -Math.PI / 2, true);

  // Außenkontakte: Ring außerhalb des Gesamtumkreises
  if (g.external.length) {
    const R = outer.get(g.rootId)! + BALLOON.externalRing;
    g.external.forEach((x, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) / g.external.length) * 2 * Math.PI;
      const r = externalRadius(x.id);
      nodes.set(x.id, { id: x.id, cx: R * Math.cos(a), cy: R * Math.sin(a), w: 2 * r, h: 2 * r, rx: r });
    });
  }

  const edges: LayoutEdge[] = [];
  for (const u of g.units) {
    if (u.id === g.rootId || !u.parentId || !nodes.has(u.parentId)) continue;
    const p = nodes.get(u.parentId)!;
    const c = nodes.get(u.id)!;
    edges.push({ id: `l:${u.id}`, from: u.parentId, to: u.id, points: [trim(p, c), trim(c, p)] });
  }
  return { nodes, edges, bounds: boundsOf(nodes.values(), edges) };
}

/** Punkt auf dem Rand von `a` in Richtung `b` (Kreis). */
export function trim(a: NodeBox, b: NodeBox): [number, number] {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.hypot(dx, dy) || 1;
  const r = Math.min(a.w, a.h) / 2;
  return [a.cx + (dx / len) * r, a.cy + (dy / len) * r];
}
