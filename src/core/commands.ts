// Alle Mutationen am Dokument. Die UI mutiert nie direkt.
// Ein Command ist eine beschriebene Immer-Rezeptur; `history.ts` wendet sie an.

import type { Draft } from "immer";
import {
  childIndex,
  createRelation,
  createTopic,
  createUnit,
  type DocumentMeta,
  type Id,
  isValidLogo,
  newId,
  type OrgDocument,
  type OrgUnit,
  type ParticipantRole,
  type Relation,
  type Settings,
  subtreeIds,
  TOPIC_PALETTE,
  type Topic,
} from "./model.ts";
import { canReparent } from "./validate.ts";

export interface Command {
  /** i18n-Schlüssel (ohne Präfix `cmd.`) für Undo-Beschriftung */
  label: string;
  /** Gleicher Schlüssel innerhalb 1 s → ein Undo-Schritt */
  coalesceKey?: string;
  /** Bei Neuanlage: ID des angelegten Objekts */
  createdId?: Id;
  recipe: (draft: Draft<OrgDocument>) => void;
}

export class CommandRejected extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
    this.name = "CommandRejected";
  }
}

function reject(reason: string): never {
  throw new CommandRejected(reason);
}

type D = Draft<OrgDocument>;

function findUnit(d: D, id: Id): Draft<OrgUnit> {
  return d.units.find((u) => u.id === id) ?? reject(`unknownUnit:${id}`);
}
function findTopic(d: D, id: Id): Draft<Topic> {
  return d.topics.find((t) => t.id === id) ?? reject(`unknownTopic:${id}`);
}
function findRelation(d: D, id: Id): Draft<Relation> {
  return d.relations.find((r) => r.id === id) ?? reject(`unknownRelation:${id}`);
}

/** Sortiert `units` in Tiefensuche-Reihenfolge (Eltern vor Kindern), Geschwisterreihenfolge bleibt. */
function normalizeOrder(d: D): void {
  const idx = childIndex(d.units as OrgUnit[]);
  const out: Draft<OrgUnit>[] = [];
  const visit = (parent: Id | null) => {
    for (const u of idx.get(parent) ?? []) {
      out.push(u as Draft<OrgUnit>);
      visit(u.id);
    }
  };
  visit(null);
  // Verwaiste OEs (sollte nicht vorkommen) ans Ende, damit nichts verloren geht
  if (out.length !== d.units.length) {
    const inOut = new Set(out.map((u) => u.id));
    for (const u of d.units) if (!inOut.has(u.id)) out.push(u);
  }
  d.units = out;
}

function siblingsOf(d: D, unit: Draft<OrgUnit>): Draft<OrgUnit>[] {
  return d.units.filter((u) => u.parentId === unit.parentId);
}

/** Setzt `unit` innerhalb der Geschwister an Position `index`. */
function placeAmongSiblings(d: D, unitId: Id, index: number): void {
  const unit = findUnit(d, unitId);
  const others = d.units.filter((u) => u.id !== unitId);
  const sibs = others.filter((u) => u.parentId === unit.parentId);
  const clamped = Math.max(0, Math.min(index, sibs.length));
  if (clamped === sibs.length) {
    d.units = [...others, unit];
  } else {
    const anchor = sibs[clamped]!;
    const pos = others.indexOf(anchor);
    others.splice(pos, 0, unit);
    d.units = others;
  }
  normalizeOrder(d);
}

/** Leere Strings und leere Objekte entfernen (Serialisierung §7.4). */
function clean<T extends object>(obj: T): void {
  for (const k of Object.keys(obj) as (keyof T)[]) {
    const v = obj[k];
    // null bleibt erhalten (z. B. parentId der Wurzel)
    if (v === undefined || v === "") delete obj[k];
    else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      clean(v as object);
      if (Object.keys(v as object).length === 0) delete obj[k];
    }
  }
}

// ---------- Organisationseinheiten ----------

export type UnitPatch = Partial<Omit<OrgUnit, "id" | "parentId" | "lead">> & {
  lead?: Partial<NonNullable<OrgUnit["lead"]>>;
};

export function addChild(parentId: Id, fields: Partial<OrgUnit> & { name: string }, index?: number): Command {
  const unit = createUnit({ ...fields, parentId });
  return {
    label: "addUnit",
    createdId: unit.id,
    recipe: (d) => {
      findUnit(d, parentId);
      d.units.push({ ...unit });
      placeAmongSiblings(d, unit.id, index ?? Number.POSITIVE_INFINITY);
    },
  };
}

/** Neue Geschwister-OE direkt nach `afterId` (Taste Enter). */
export function addSibling(afterId: Id, fields: Partial<OrgUnit> & { name: string }): Command {
  const unit = createUnit({ ...fields, parentId: null });
  return {
    label: "addUnit",
    createdId: unit.id,
    recipe: (d) => {
      const after = findUnit(d, afterId);
      if (after.parentId === null) reject("rootSibling");
      const sibs = siblingsOf(d, after);
      d.units.push({ ...unit, parentId: after.parentId });
      placeAmongSiblings(d, unit.id, sibs.indexOf(after) + 1);
    },
  };
}

export function updateUnit(id: Id, patch: UnitPatch): Command {
  const keys = Object.keys(patch).sort();
  const leadKeys = patch.lead ? Object.keys(patch.lead).sort() : [];
  return {
    label: "updateUnit",
    coalesceKey: `unit:${id}:${keys.join(",")}:${leadKeys.join(",")}`,
    recipe: (d) => {
      const u = findUnit(d, id);
      const { lead, ...rest } = patch;
      if (rest.name !== undefined && !rest.name.trim()) reject("emptyName");
      Object.assign(u, rest);
      if (lead) u.lead = { ...(u.lead ?? {}), ...lead };
      if (u.isStaff === false) delete u.isStaff;
      clean(u);
    },
  };
}

/** Löscht OE samt Teilbaum, Beteiligungen, Beziehungen und Anheftungen — ein Undo-Schritt (§7.3). */
export function deleteUnit(id: Id): Command {
  return {
    label: "deleteUnit",
    recipe: (d) => {
      const u = findUnit(d, id);
      if (u.parentId === null) reject("deleteRoot");
      const gone = new Set(subtreeIds(d as OrgDocument, id));
      d.units = d.units.filter((x) => !gone.has(x.id));
      for (const t of d.topics) t.participants = t.participants.filter((p) => !gone.has(p.unitId));
      d.relations = d.relations.filter((r) => !gone.has(r.from) && !gone.has(r.to));
      for (const gid of gone) delete d.view.network.pinned[gid];
    },
  };
}

/** Einrücken: wird letztes Kind des vorherigen Geschwisters (Tab). */
export function indentUnit(id: Id): Command {
  return {
    label: "moveUnit",
    recipe: (d) => {
      const u = findUnit(d, id);
      if (u.parentId === null) reject("moveRoot");
      const sibs = siblingsOf(d, u);
      const i = sibs.indexOf(u);
      if (i <= 0) reject("noPreviousSibling");
      u.parentId = sibs[i - 1]!.id;
      placeAmongSiblings(d, id, Number.POSITIVE_INFINITY);
    },
  };
}

/** Ausrücken: wird Geschwister direkt nach dem bisherigen Elternknoten (Shift+Tab). */
export function outdentUnit(id: Id): Command {
  return {
    label: "moveUnit",
    recipe: (d) => {
      const u = findUnit(d, id);
      if (u.parentId === null) reject("moveRoot");
      const parent = findUnit(d, u.parentId);
      if (parent.parentId === null) reject("wouldCreateRoot");
      const parentSibs = siblingsOf(d, parent);
      const pos = parentSibs.indexOf(parent);
      u.parentId = parent.parentId;
      placeAmongSiblings(d, id, pos + 1);
    },
  };
}

/** Reihenfolge ändern (Alt+↑ / Alt+↓). */
export function moveUnit(id: Id, delta: -1 | 1): Command {
  return {
    label: "moveUnit",
    recipe: (d) => {
      const u = findUnit(d, id);
      const sibs = siblingsOf(d, u);
      const i = sibs.indexOf(u);
      const j = i + delta;
      if (j < 0 || j >= sibs.length) reject("noNeighbour");
      placeAmongSiblings(d, id, j);
    },
  };
}

/** Umhängen unter eine andere OE (Formularfeld „Übergeordnete OE“). */
export function reparentUnit(id: Id, newParentId: Id, index?: number): Command {
  return {
    label: "moveUnit",
    recipe: (d) => {
      if (!canReparent(d as OrgDocument, id, newParentId)) reject("invalidParent");
      const u = findUnit(d, id);
      if (u.parentId === newParentId && index === undefined) return;
      u.parentId = newParentId;
      placeAmongSiblings(d, id, index ?? Number.POSITIVE_INFINITY);
    },
  };
}

/** Fügt einen fertigen Teilbaum (z. B. aus Gliederungsimport) unter `parentId` ein. */
export function insertUnits(parentId: Id, units: OrgUnit[]): Command {
  return {
    label: "insertUnits",
    recipe: (d) => {
      findUnit(d, parentId);
      const ids = new Set(units.map((u) => u.id));
      for (const u of units) {
        if (d.units.some((x) => x.id === u.id)) reject(`duplicateId:${u.id}`);
        const parent = u.parentId === null ? parentId : u.parentId;
        if (parent !== parentId && !ids.has(parent)) reject(`missingParent:${u.id}`);
        d.units.push({ ...u, parentId: parent });
      }
      normalizeOrder(d);
    },
  };
}

// ---------- Projekte & Themen ----------

export function addTopic(fields: Partial<Topic> & { title: string }): Command {
  const id = fields.id ?? newId("t");
  return {
    label: "addTopic",
    createdId: id,
    recipe: (d) => {
      const used = new Set(d.topics.map((t) => t.color));
      const free = TOPIC_PALETTE.findIndex((c) => !used.has(c));
      const topic = createTopic({ ...fields, id }, free >= 0 ? free : d.topics.length);
      if (fields.color) topic.color = fields.color;
      d.topics.push(topic);
    },
  };
}

export type TopicPatch = Partial<Omit<Topic, "id" | "participants" | "period">> & {
  period?: Topic["period"];
};

export function updateTopic(id: Id, patch: TopicPatch): Command {
  return {
    label: "updateTopic",
    coalesceKey: `topic:${id}:${Object.keys(patch).sort().join(",")}`,
    recipe: (d) => {
      const t = findTopic(d, id);
      if (patch.title !== undefined && !patch.title.trim()) reject("emptyTitle");
      const { period, ...rest } = patch;
      Object.assign(t, rest);
      if (period) {
        const next = { ...period };
        if (!next.from) delete next.from;
        if (!next.to) delete next.to;
        if (next.from && next.to && next.from > next.to) reject("invalidPeriod");
        t.period = next;
      }
      for (const k of ["shortName", "note"] as const) if (!t[k]) delete t[k];
    },
  };
}

export function deleteTopic(id: Id): Command {
  return {
    label: "deleteTopic",
    recipe: (d) => {
      findTopic(d, id);
      // Sicht/Filter bleiben unberührt (kein Undo-Gegenstand); filter.ts ignoriert unbekannte IDs.
      d.topics = d.topics.filter((t) => t.id !== id);
    },
  };
}

/** Beteiligung setzen; `null` entfernt sie. */
export function setParticipant(topicId: Id, unitId: Id, role: ParticipantRole | null): Command {
  return {
    label: "setParticipant",
    recipe: (d) => {
      const t = findTopic(d, topicId);
      findUnit(d, unitId);
      const existing = t.participants.find((p) => p.unitId === unitId);
      if (role === null) t.participants = t.participants.filter((p) => p.unitId !== unitId);
      else if (existing) existing.role = role;
      else t.participants.push({ unitId, role });
    },
  };
}

/** Klick-Zyklus der Beteiligungsmatrix: leer → mitwirkend → federführend → leer. */
export function cycleParticipant(topic: Topic, unitId: Id): Command {
  const cur = topic.participants.find((p) => p.unitId === unitId)?.role;
  const next: ParticipantRole | null = cur === undefined ? "member" : cur === "member" ? "lead" : null;
  return setParticipant(topic.id, unitId, next);
}

export function moveTopic(id: Id, delta: -1 | 1): Command {
  return {
    label: "moveTopic",
    recipe: (d) => {
      const i = d.topics.findIndex((t) => t.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.topics.length) reject("noNeighbour");
      const [t] = d.topics.splice(i, 1);
      d.topics.splice(j, 0, t!);
    },
  };
}

// ---------- Beziehungen ----------

export function addRelation(fields: Partial<Relation> & { from: Id; to: Id }): Command {
  const rel = createRelation(fields);
  return {
    label: "addRelation",
    createdId: rel.id,
    recipe: (d) => {
      findUnit(d, rel.from);
      findUnit(d, rel.to);
      if (rel.from === rel.to) reject("selfRelation");
      d.relations.push({ ...rel });
    },
  };
}

export function updateRelation(id: Id, patch: Partial<Omit<Relation, "id">>): Command {
  return {
    label: "updateRelation",
    coalesceKey: `relation:${id}:${Object.keys(patch).sort().join(",")}`,
    recipe: (d) => {
      const r = findRelation(d, id);
      Object.assign(r, patch);
      findUnit(d, r.from);
      findUnit(d, r.to);
      if (r.from === r.to) reject("selfRelation");
      if (!r.note) delete r.note;
    },
  };
}

export function deleteRelation(id: Id): Command {
  return {
    label: "deleteRelation",
    recipe: (d) => {
      findRelation(d, id);
      d.relations = d.relations.filter((r) => r.id !== id);
    },
  };
}

// ---------- Dokument ----------

export function updateMeta(patch: Partial<Omit<DocumentMeta, "created" | "modified">>): Command {
  return {
    label: "updateMeta",
    coalesceKey: `meta:${Object.keys(patch).sort().join(",")}`,
    recipe: (d) => {
      if (patch.logo && !isValidLogo(patch.logo)) reject("invalidLogo");
      Object.assign(d.meta, patch);
      for (const k of ["organization", "department", "author", "asOf", "logo"] as const)
        if (!d.meta[k]) delete d.meta[k];
    },
  };
}

export function updateSettings(patch: Partial<Settings>): Command {
  return {
    label: "updateSettings",
    coalesceKey: `settings:${Object.keys(patch).sort().join(",")}`,
    recipe: (d) => {
      if (patch.spanOfControlHint !== undefined && !(patch.spanOfControlHint >= 1)) reject("invalidSpan");
      Object.assign(d.settings, patch);
    },
  };
}

/** Knoten in der Netz-Sicht anheften (`null` löst). Teil der Undo-History (§10.3). */
export function pinNode(unitId: Id, pos: { x: number; y: number } | null): Command {
  return {
    label: "pinNode",
    recipe: (d) => {
      if (pos) d.view.network.pinned[unitId] = { x: Math.round(pos.x), y: Math.round(pos.y) };
      else delete d.view.network.pinned[unitId];
    },
  };
}

/** Fügt importierte Projekte/Themen in einem Schritt hinzu. */
export function insertTopics(topics: Topic[]): Command {
  return {
    label: "importTopics",
    recipe: (d) => {
      for (const t of topics) {
        if (d.topics.some((x) => x.id === t.id)) reject(`duplicateId:${t.id}`);
        for (const p of t.participants) findUnit(d, p.unitId);
        d.topics.push({ ...t, period: { ...t.period }, participants: t.participants.map((p) => ({ ...p })) });
      }
    },
  };
}
