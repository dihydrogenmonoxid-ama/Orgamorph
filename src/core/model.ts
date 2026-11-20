// Datenmodell. Reines TypeScript, kein DOM.

export type Id = string;
export type IsoDate = string;

export const TOPIC_TYPES = ["project", "workingGroup", "committee", "crossCutting", "other"] as const;
export type TopicType = (typeof TOPIC_TYPES)[number];

export const RELATION_KINDS = ["reportsTo", "directs", "informs", "coordinates"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const VIEW_MODES = ["tree", "star", "network"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export type ParticipantRole = "lead" | "member";

export interface Lead {
  title?: string;
  code?: string;
  positionNumber?: string;
  holder?: string;
}

export interface OrgUnit {
  id: Id;
  parentId: Id | null;
  name: string;
  shortName?: string;
  type?: string;
  responsibilities?: string;
  isStaff?: boolean;
  lead?: Lead;
  note?: string;
}

export interface Participant {
  unitId: Id;
  role: ParticipantRole;
}

export interface Topic {
  id: Id;
  title: string;
  shortName?: string;
  type: TopicType;
  period: { from?: IsoDate; to?: IsoDate };
  participants: Participant[];
  color: string;
  note?: string;
}

export interface Relation {
  id: Id;
  from: Id;
  to: Id;
  kind: RelationKind;
  note?: string;
}

export interface Settings {
  levelNames: string[];
  spanOfControlHint: number;
}

export interface LabelOptions {
  shortNames: boolean;
  leadCode: boolean;
  holder: boolean;
  positionNumber: boolean;
}

export interface Filter {
  focusUnitId: Id | null;
  showExternal: boolean;
  date: IsoDate | null;
  topicTypes: TopicType[] | "all";
  hiddenTopics: Id[];
  relationKinds: RelationKind[] | "all";
}

export interface ViewState {
  mode: ViewMode;
  label: LabelOptions;
  filter: Filter;
  tree: { orientation: "top-down" | "left-right"; stackLeaves: boolean };
  network: { pinned: Record<Id, { x: number; y: number }> };
}

export interface DocumentMeta {
  title: string;
  organization?: string;
  /** Plankopf: erstellende Organisationseinheit/Abteilung */
  department?: string;
  /** Plankopf: Ersteller (Name). Wird nur im Plankopf ausgegeben. */
  author?: string;
  asOf?: IsoDate;
  created: string;
  modified: string;
  /** Plankopf: Logo als data:-URL (PNG, JPEG, WebP oder SVG), höchstens LOGO_MAX_LENGTH Zeichen */
  logo?: string;
}

export const LOGO_PATTERN = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
export const LOGO_MAX_LENGTH = 400_000;

export function isValidLogo(s: unknown): s is string {
  return typeof s === "string" && s.length <= LOGO_MAX_LENGTH && LOGO_PATTERN.test(s);
}

export interface OrgDocument {
  format: "orgamorph";
  schemaVersion: 1;
  /** Dokument-ID (Schlüssel für Browser-Speicher). TODO(decision): in §7.1 nicht aufgeführt, aber für §5.1 nötig. */
  id: Id;
  meta: DocumentMeta;
  units: OrgUnit[];
  topics: Topic[];
  relations: Relation[];
  settings: Settings;
  view: ViewState;
}

export const SCHEMA_VERSION = 1 as const;

/** Okabe-Ito, farbsehschwächen-tauglich (§11.2). */
export const TOPIC_PALETTE = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#56B4E9",
  "#D55E00",
  "#F0E442",
  "#000000",
] as const;

export const DEFAULT_LEVEL_NAMES = ["Behördenleitung", "Abteilung", "Referat", "Sachgebiet"];

// ---------- IDs ----------

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function randomBytes(n: number): Uint8Array {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  const bytes = new Uint8Array(n);
  if (c) return c.getRandomValues(bytes);
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** 10 Zeichen [a-z0-9] mit Präfix, z. B. `u_k3f9a1x2qp`. */
export function newId(prefix: "u" | "t" | "r" | "d"): Id {
  let s = "";
  while (s.length < 10) {
    for (const b of randomBytes(16)) {
      // 252 = 7 · 36: Rejection Sampling vermeidet Verzerrung
      if (b < 252 && s.length < 10) s += ID_ALPHABET[b % 36];
    }
  }
  return `${prefix}_${s}`;
}

export const ID_PATTERN = /^[a-z]_[a-z0-9]{10}$/;

// ---------- Factories ----------

export function nowIso(): string {
  return new Date().toISOString();
}

export function defaultSettings(): Settings {
  return { levelNames: [...DEFAULT_LEVEL_NAMES], spanOfControlHint: 7 };
}

export function defaultView(): ViewState {
  return {
    mode: "tree",
    label: { shortNames: true, leadCode: true, holder: false, positionNumber: false },
    filter: {
      focusUnitId: null,
      showExternal: false,
      date: null,
      topicTypes: "all",
      hiddenTopics: [],
      relationKinds: "all",
    },
    tree: { orientation: "top-down", stackLeaves: false },
    network: { pinned: {} },
  };
}

export function createUnit(partial: Partial<OrgUnit> & { name: string }): OrgUnit {
  return { id: partial.id ?? newId("u"), parentId: partial.parentId ?? null, ...partial };
}

export function createTopic(partial: Partial<Topic> & { title: string }, index = 0): Topic {
  return {
    id: partial.id ?? newId("t"),
    type: "project",
    period: {},
    participants: [],
    color: TOPIC_PALETTE[index % TOPIC_PALETTE.length]!,
    ...partial,
  };
}

export function createRelation(partial: Partial<Relation> & { from: Id; to: Id }): Relation {
  return { id: partial.id ?? newId("r"), kind: "reportsTo", ...partial };
}

/** Neues Dokument mit genau einer Wurzel-OE. */
export function emptyDocument(title = "Neue Organisation", rootName = "Leitung"): OrgDocument {
  const now = nowIso();
  return {
    format: "orgamorph",
    schemaVersion: SCHEMA_VERSION,
    id: newId("d"),
    meta: { title, created: now, modified: now },
    units: [createUnit({ name: rootName, parentId: null })],
    topics: [],
    relations: [],
    settings: defaultSettings(),
    view: defaultView(),
  };
}

// ---------- Abfragen ----------

export function unitById(doc: OrgDocument, id: Id): OrgUnit | undefined {
  return doc.units.find((u) => u.id === id);
}

export function rootUnit(doc: OrgDocument): OrgUnit | undefined {
  return doc.units.find((u) => u.parentId === null);
}

/** Kinder in Geschwisterreihenfolge (Array-Reihenfolge). */
export function childrenOf(doc: OrgDocument, id: Id | null): OrgUnit[] {
  return doc.units.filter((u) => u.parentId === id);
}

export function childIndex(units: readonly OrgUnit[]): Map<Id | null, OrgUnit[]> {
  const m = new Map<Id | null, OrgUnit[]>();
  for (const u of units) {
    const list = m.get(u.parentId);
    if (list) list.push(u);
    else m.set(u.parentId, [u]);
  }
  return m;
}

/** IDs des Teilbaums inkl. `id` selbst, in Tiefensuche-Reihenfolge. */
export function subtreeIds(doc: Pick<OrgDocument, "units">, id: Id): Id[] {
  const idx = childIndex(doc.units);
  const out: Id[] = [];
  const stack: Id[] = [id];
  const seen = new Set<Id>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    const kids = idx.get(cur) ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!.id);
  }
  return out;
}

/** Vorfahren von nah nach fern (ohne `id` selbst). */
export function ancestorIds(doc: Pick<OrgDocument, "units">, id: Id): Id[] {
  const byId = new Map(doc.units.map((u) => [u.id, u]));
  const out: Id[] = [];
  const seen = new Set<Id>([id]);
  let cur = byId.get(id)?.parentId ?? null;
  while (cur !== null && !seen.has(cur)) {
    out.push(cur);
    seen.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}

export function isDescendant(doc: Pick<OrgDocument, "units">, candidate: Id, ancestor: Id): boolean {
  return ancestorIds(doc, candidate).includes(ancestor);
}

export function depthOf(doc: Pick<OrgDocument, "units">, id: Id): number {
  return ancestorIds(doc, id).length;
}

/** Anzeige-Kürzel: Kürzel, sonst Name. */
export function unitLabel(u: Pick<OrgUnit, "name" | "shortName">): string {
  return u.shortName?.trim() || u.name;
}

/** Läuft das Thema am Stichtag? Ohne Datum: immer. */
export function topicActiveOn(topic: Topic, date: IsoDate | null): boolean {
  if (!date) return true;
  const { from, to } = topic.period;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function isIsoDate(s: unknown): boolean {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
