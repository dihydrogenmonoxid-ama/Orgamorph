// Filter: Fokus, Außenkontakte, Stichtag, Typen → Teilgraph.
// Wirkt auf alle Sichten und alle Exporte.

import {
  ancestorIds,
  childIndex,
  type Filter,
  type Id,
  type OrgDocument,
  type OrgUnit,
  type Relation,
  type Topic,
  topicActiveOn,
} from "./model.ts";

/** Gebündelte Außenkontakte: OEs außerhalb des Fokus, gruppiert nach ihrer obersten Ebene. */
export interface ExternalGroup {
  /** Knoten-ID `x:<OE-ID der obersten Ebene>` */
  id: string;
  /** OE der obersten Ebene (Kind der Wurzel) bzw. die Wurzel selbst */
  anchorId: Id;
  memberIds: Id[];
}

export interface FilteredTopic extends Topic {
  /** Beteiligte, abgebildet auf Knoten-IDs (OE-ID oder `x:…`), ohne Doppelungen */
  nodeIds: string[];
}

export interface FilteredRelation extends Relation {
  fromNode: string;
  toNode: string;
}

export interface FilteredGraph {
  rootId: Id;
  /** Sichtbare OEs (Fokus-Teilbaum), Tiefensuche-Reihenfolge */
  units: OrgUnit[];
  unitIds: ReadonlySet<Id>;
  external: ExternalGroup[];
  topics: FilteredTopic[];
  relations: FilteredRelation[];
  /** OE-ID → Knoten-ID (für OEs im Fokus identisch, sonst Außengruppe) */
  nodeOf: (unitId: Id) => string | undefined;
}

export const EXTERNAL_PREFIX = "x:";

/** Fokus auflösen: unbekannter Fokus (z. B. nach Löschen) gilt als „kein Fokus“. */
export function effectiveFocus(doc: OrgDocument, filter: Filter): Id | null {
  const f = filter.focusUnitId;
  return f && doc.units.some((u) => u.id === f) ? f : null;
}

export function applyFilter(doc: OrgDocument, filter: Filter = doc.view.filter): FilteredGraph {
  const root = doc.units.find((u) => u.parentId === null);
  if (!root) throw new Error("noRoot");
  const focus = effectiveFocus(doc, filter) ?? root.id;

  const idx = childIndex(doc.units);
  const units: OrgUnit[] = [];
  const walk = (u: OrgUnit) => {
    units.push(u);
    for (const c of idx.get(u.id) ?? []) walk(c);
  };
  walk(doc.units.find((u) => u.id === focus)!);
  const unitIds = new Set(units.map((u) => u.id));

  // Außengruppe: oberste Ebene unterhalb der Wurzel (Kind der Wurzel), Wurzel bildet eigene Gruppe.
  const anchorOf = (unitId: Id): Id => {
    const chain = ancestorIds(doc, unitId);
    if (chain.length === 0) return unitId;
    if (chain.length === 1) return unitId;
    return chain[chain.length - 2]!;
  };

  const topicTypeOk = (t: Topic) => filter.topicTypes === "all" || filter.topicTypes.includes(t.type);
  const hidden = new Set(filter.hiddenTopics);
  const activeTopics = doc.topics.filter(
    (t) => !hidden.has(t.id) && topicTypeOk(t) && topicActiveOn(t, filter.date),
  );
  const relKindOk = (r: Relation) => filter.relationKinds === "all" || filter.relationKinds.includes(r.kind);
  const activeRelations = doc.relations.filter(relKindOk);

  // Welche Außen-OEs reichen in den Fokus hinein?
  const externalMembers = new Map<Id, Set<Id>>(); // anchor → members
  const addExternal = (unitId: Id) => {
    if (unitIds.has(unitId)) return;
    const a = anchorOf(unitId);
    const set = externalMembers.get(a) ?? new Set<Id>();
    set.add(unitId);
    externalMembers.set(a, set);
  };
  if (filter.showExternal && focus !== root.id) {
    for (const t of activeTopics) {
      const ids = t.participants.map((p) => p.unitId);
      if (ids.some((id) => unitIds.has(id))) for (const id of ids) addExternal(id);
    }
    for (const r of activeRelations) {
      if (unitIds.has(r.from) !== unitIds.has(r.to)) {
        addExternal(r.from);
        addExternal(r.to);
      }
    }
  }

  const memberToGroup = new Map<Id, string>();
  const external: ExternalGroup[] = [];
  // Reihenfolge der Gruppen = Reihenfolge der Anker im Dokument (deterministisch)
  for (const u of doc.units) {
    const members = externalMembers.get(u.id);
    if (!members) continue;
    const id = `${EXTERNAL_PREFIX}${u.id}`;
    const memberIds = doc.units.filter((x) => members.has(x.id)).map((x) => x.id);
    external.push({ id, anchorId: u.id, memberIds });
    for (const m of memberIds) memberToGroup.set(m, id);
  }

  const nodeOf = (unitId: Id): string | undefined =>
    unitIds.has(unitId) ? unitId : memberToGroup.get(unitId);

  const topics: FilteredTopic[] = [];
  for (const t of activeTopics) {
    if (!t.participants.some((p) => unitIds.has(p.unitId))) continue;
    const nodeIds: string[] = [];
    for (const p of t.participants) {
      const n = nodeOf(p.unitId);
      if (n && !nodeIds.includes(n)) nodeIds.push(n);
    }
    topics.push({ ...t, nodeIds });
  }

  const relations: FilteredRelation[] = [];
  for (const r of activeRelations) {
    if (!unitIds.has(r.from) && !unitIds.has(r.to)) continue;
    const fromNode = nodeOf(r.from);
    const toNode = nodeOf(r.to);
    if (!fromNode || !toNode || fromNode === toNode) continue;
    relations.push({ ...r, fromNode, toNode });
  }

  return { rootId: focus, units, unitIds, external, topics, relations, nodeOf };
}

/**
 * Lokaler Graph (Netz-Sicht): beschränkt den Teilgraphen auf `keep` (Knoten-IDs).
 * Die Wurzel bleibt erhalten, wenn sie enthalten ist; Linienkanten entfallen für ausgeblendete Eltern.
 */
export function restrictGraph(g: FilteredGraph, keep: ReadonlySet<string>): FilteredGraph {
  const units = g.units.filter((u) => keep.has(u.id));
  const unitIds = new Set(units.map((u) => u.id));
  const external = g.external.filter((x) => keep.has(x.id));
  const topics = g.topics
    .map((t) => ({ ...t, nodeIds: t.nodeIds.filter((n) => keep.has(n)) }))
    .filter((t) => t.nodeIds.length > 0);
  const relations = g.relations.filter((r) => keep.has(r.fromNode) && keep.has(r.toNode));
  // Wurzel des lokalen Graphen: höchste enthaltene Ebene
  const depth = new Map<Id, number>();
  for (const u of g.units)
    depth.set(u.id, u.parentId && depth.has(u.parentId) ? depth.get(u.parentId)! + 1 : 0);
  let rootId = g.rootId;
  if (!unitIds.has(rootId)) {
    let best = Number.POSITIVE_INFINITY;
    for (const u of units) if ((depth.get(u.id) ?? 0) < best) [best, rootId] = [depth.get(u.id) ?? 0, u.id];
  }
  return {
    rootId,
    units,
    unitIds,
    external,
    topics,
    relations,
    nodeOf: (id) => {
      const n = g.nodeOf(id);
      return n && keep.has(n) ? n : undefined;
    },
  };
}
