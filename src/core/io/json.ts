// Laden und Speichern von *.orgamorph.json.
// 2 Leerzeichen, feste Schlüsselreihenfolge, leere optionale Felder weglassen, "\n" am Ende,
// unbekannte Felder erhalten.

import { isNewerSchema, migrate } from "../migrate.ts";
import { type OrgDocument, SCHEMA_VERSION } from "../model.ts";
import { errorsOf, type Issue, validate } from "../validate.ts";

type Json = Record<string, unknown>;

const KEY_ORDER: Record<string, string[]> = {
  document: ["format", "schemaVersion", "id", "meta", "units", "topics", "relations", "settings", "view"],
  meta: ["title", "organization", "department", "author", "asOf", "created", "modified", "logo"],
  unit: ["id", "parentId", "name", "shortName", "type", "responsibilities", "isStaff", "lead", "note"],
  lead: ["title", "code", "positionNumber", "holder"],
  topic: ["id", "title", "shortName", "type", "period", "participants", "color", "note"],
  period: ["from", "to"],
  participant: ["unitId", "role"],
  relation: ["id", "from", "to", "kind", "note"],
  settings: ["levelNames", "spanOfControlHint"],
  view: ["mode", "label", "filter", "tree", "network"],
  label: ["shortNames", "leadCode", "holder", "positionNumber"],
  filter: ["focusUnitId", "showExternal", "date", "topicTypes", "hiddenTopics", "relationKinds"],
  tree: ["orientation", "stackLeaves"],
  network: ["pinned"],
  point: ["x", "y"],
};

/** Felder, die auch leer geschrieben werden (Pflicht laut Schema). */
const REQUIRED = new Set([
  "document.units",
  "document.topics",
  "document.relations",
  "unit.parentId",
  "topic.period",
  "topic.participants",
  "filter.focusUnitId",
  "filter.date",
  "filter.hiddenTopics",
  "network.pinned",
  "settings.levelNames",
]);

const CHILD_KIND: Record<string, Record<string, string>> = {
  document: {
    meta: "meta",
    units: "unit",
    topics: "topic",
    relations: "relation",
    settings: "settings",
    view: "view",
  },
  unit: { lead: "lead" },
  topic: { period: "period", participants: "participant" },
  view: { label: "label", filter: "filter", tree: "tree", network: "network" },
  network: { pinned: "pinnedMap" },
  pinnedMap: {},
};

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === "") return true;
  if (isObj(v)) return Object.keys(v).length === 0;
  return false;
}

function order(value: unknown, kind: string): unknown {
  if (Array.isArray(value)) return value.map((v) => order(v, kind));
  if (!isObj(value)) return value;
  if (kind === "pinnedMap") {
    const out: Json = {};
    for (const k of Object.keys(value).sort()) out[k] = order(value[k], "point");
    return out;
  }
  const known = KEY_ORDER[kind] ?? [];
  const keys = [...known.filter((k) => k in value), ...Object.keys(value).filter((k) => !known.includes(k))];
  const out: Json = {};
  for (const k of keys) {
    const childKind = CHILD_KIND[kind]?.[k] ?? "unknown";
    const v = order(value[k], childKind);
    if (isEmpty(v) && !REQUIRED.has(`${kind}.${k}`)) continue;
    if (v === null && !REQUIRED.has(`${kind}.${k}`) && known.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

export function serialize(doc: OrgDocument): string {
  return `${JSON.stringify(order(doc, "document"), null, 2)}\n`;
}

export interface ParseResult {
  doc: OrgDocument;
  /** Dokument stammt aus einer neueren Version: nur lesend öffnen. */
  readOnly: boolean;
  issues: Issue[];
}

export type ParseErrorCode = "notJson" | "notOrgamorph" | "invalid";

export class ParseError extends Error {
  readonly code: ParseErrorCode;
  constructor(code: ParseErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.name = "ParseError";
  }
}

export function parse(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    throw new ParseError("notJson", (e as Error).message);
  }
  if (!isObj(raw) || raw.format !== "orgamorph") throw new ParseError("notOrgamorph");
  const readOnly = isNewerSchema(raw.schemaVersion);
  const migrated = migrate(raw);
  if (!readOnly) migrated.schemaVersion = SCHEMA_VERSION;
  const doc = migrated as unknown as OrgDocument;
  const issues = validate(doc);
  const errors = errorsOf(issues);
  if (errors.length && !readOnly) {
    throw new ParseError("invalid", errors.map((e) => `${e.code}(${e.ids.join(",")})`).join("; "));
  }
  return { doc, readOnly, issues };
}
