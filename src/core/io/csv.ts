// CSV-Import und -Export. Excel-kompatibel:
// Trennzeichen „;“, „,“ oder Tab automatisch, UTF-8 mit/ohne BOM, Anführungszeichen nach RFC 4180.

import {
  type Id,
  isIsoDate,
  type LabelOptions,
  newId,
  type OrgDocument,
  type OrgUnit,
  type ParticipantRole,
  TOPIC_PALETTE,
  TOPIC_TYPES,
  type Topic,
  type TopicType,
} from "../model.ts";

export type Delimiter = ";" | "," | "\t";

/** Zählt Trennzeichen in der ersten Zeile außerhalb von Anführungszeichen. */
export function detectDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "\n" || c === "\r")) break;
    else if (!quoted && c in counts) counts[c as Delimiter]++;
  }
  if (counts["\t"] > counts[";"] && counts["\t"] > counts[","]) return "\t";
  return counts[","] > counts[";"] ? "," : ";";
}

export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = input.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === d) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/** Schutz vor Formel-Injektion in Tabellenkalkulationen. */
function safeCell(v: string): string {
  return /^[=+@\t\r]/.test(v) || /^-[^\d\s]/.test(v) ? `'${v}` : v;
}

export function toCsv(rows: readonly (readonly string[])[], delimiter: Delimiter = ";"): string {
  const esc = (v: string) => {
    const s = safeCell(v);
    return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(esc).join(delimiter)).join("\r\n")}\r\n`;
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

function headerIndex(header: readonly string[], aliases: Record<string, string[]>): Map<string, number> {
  const m = new Map<string, number>();
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, list] of Object.entries(aliases))
      if (!m.has(key) && list.some((a) => norm(a) === n)) m.set(key, i);
  });
  return m;
}

export const UNIT_COLUMNS = [
  "id",
  "parentId",
  "name",
  "shortName",
  "type",
  "leadTitle",
  "leadCode",
  "positionNumber",
  "holder",
] as const;

const UNIT_ALIASES: Record<string, string[]> = {
  id: ["id"],
  parentId: ["parentId", "parent", "übergeordnet", "eltern"],
  name: ["name", "bezeichnung"],
  shortName: ["shortName", "kürzel", "kurz"],
  type: ["type", "typ", "ebene"],
  leadTitle: ["leadTitle", "leitung", "funktion"],
  leadCode: ["leadCode", "funktionskürzel"],
  positionNumber: ["positionNumber", "stellennummer", "stelle"],
  holder: ["holder", "besetzung", "inhaber"],
  responsibilities: ["responsibilities", "aufgabenbereich", "aufgaben"],
  isStaff: ["isStaff", "stabsstelle", "stab"],
  note: ["note", "notiz"],
};

export type CsvIssue =
  | { code: "missingColumn"; column: string }
  | { code: "emptyName"; row: number }
  | { code: "unknownParent"; row: number; value: string }
  | { code: "duplicateId"; row: number; value: string }
  | { code: "cycle"; row: number }
  | { code: "unknownUnit"; row: number; value: string }
  | { code: "invalidDate"; row: number; value: string }
  | { code: "unknownType"; row: number; value: string };

export interface UnitCsvResult {
  units: OrgUnit[];
  issues: CsvIssue[];
}

const truthy = (s: string) => ["1", "x", "ja", "yes", "true", "wahr"].includes(s.trim().toLowerCase());

/** OEs aus CSV. IDs und parentId dürfen beliebige Kennungen sein; sie werden auf neue IDs abgebildet. */
export function importUnitsCsv(text: string, makeId: () => Id = () => newId("u")): UnitCsvResult {
  return importUnitsRows(parseCsv(text), makeId);
}

/** OEs aus Tabellenzeilen (CSV oder XLSX); erste Zeile = Spaltenköpfe. */
export function importUnitsRows(rows: string[][], makeId: () => Id = () => newId("u")): UnitCsvResult {
  rows = rows.filter((r) => r.some((x) => x.trim() !== ""));
  const issues: CsvIssue[] = [];
  const header = rows[0] ?? [];
  const col = headerIndex(header, UNIT_ALIASES);
  if (!col.has("name")) return { units: [], issues: [{ code: "missingColumn", column: "name" }] };
  const get = (r: string[], k: string) => {
    const i = col.get(k);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };

  const keyToId = new Map<string, Id>();
  const pending: { unit: OrgUnit; parentKey: string; row: number }[] = [];
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const name = get(r, "name");
    if (!name) {
      issues.push({ code: "emptyName", row: rowNo });
      return;
    }
    const key = get(r, "id") || `#${rowNo}`;
    if (keyToId.has(key)) {
      issues.push({ code: "duplicateId", row: rowNo, value: key });
      return;
    }
    const id = makeId();
    keyToId.set(key, id);
    const lead = {
      title: get(r, "leadTitle"),
      code: get(r, "leadCode"),
      positionNumber: get(r, "positionNumber"),
      holder: get(r, "holder"),
    };
    const unit: OrgUnit = { id, parentId: null, name };
    const shortName = get(r, "shortName");
    if (shortName) unit.shortName = shortName;
    const type = get(r, "type");
    if (type) unit.type = type;
    const resp = get(r, "responsibilities");
    if (resp) unit.responsibilities = resp;
    if (truthy(get(r, "isStaff"))) unit.isStaff = true;
    const cleanLead = Object.fromEntries(Object.entries(lead).filter(([, v]) => v));
    if (Object.keys(cleanLead).length) unit.lead = cleanLead;
    const note = get(r, "note");
    if (note) unit.note = note;
    pending.push({ unit, parentKey: get(r, "parentId"), row: rowNo });
  });

  // parentId darf auch ein Kürzel sein
  const byShort = new Map<string, Id>();
  for (const p of pending)
    if (p.unit.shortName && !byShort.has(p.unit.shortName)) byShort.set(p.unit.shortName, p.unit.id);
  for (const p of pending) {
    if (!p.parentKey) continue;
    const pid = keyToId.get(p.parentKey) ?? byShort.get(p.parentKey);
    if (pid && pid !== p.unit.id) p.unit.parentId = pid;
    else issues.push({ code: "unknownParent", row: p.row, value: p.parentKey });
  }

  // Zyklen auflösen: betroffene OE wird oberste Ebene
  const byId = new Map(pending.map((p) => [p.unit.id, p]));
  for (const p of pending) {
    const seen = new Set<Id>([p.unit.id]);
    let cur = p.unit.parentId;
    while (cur) {
      if (seen.has(cur)) {
        issues.push({ code: "cycle", row: p.row });
        p.unit.parentId = null;
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)?.unit.parentId ?? null;
    }
  }
  return { units: sortDfs(pending.map((p) => p.unit)), issues };
}

function sortDfs(units: OrgUnit[]): OrgUnit[] {
  const kids = new Map<Id | null, OrgUnit[]>();
  for (const u of units) kids.set(u.parentId, [...(kids.get(u.parentId) ?? []), u]);
  const out: OrgUnit[] = [];
  const visit = (p: Id | null) => {
    for (const u of kids.get(p) ?? []) {
      out.push(u);
      visit(u.id);
    }
  };
  visit(null);
  return out;
}

const TOPIC_TYPE_ALIASES: Record<TopicType, string[]> = {
  project: ["project", "projekt"],
  workingGroup: ["workingGroup", "arbeitsgruppe", "arbeitskreis", "ag", "ak", "working group"],
  committee: ["committee", "gremium", "ausschuss"],
  crossCutting: ["crossCutting", "querschnittsaufgabe", "querschnitt", "cross-cutting"],
  other: ["other", "sonstiges", "sonstige"],
};

export function parseTopicType(s: string): TopicType | null {
  const n = norm(s);
  if (!n) return "project";
  for (const t of TOPIC_TYPES) if (TOPIC_TYPE_ALIASES[t].some((a) => norm(a) === n)) return t;
  return null;
}

/** Excel-Seriennummer (1900er System) → ISO-Datum. */
export function excelSerialToIso(serial: number): string {
  const ms = Math.floor(serial) * 86400000 + Date.UTC(1899, 11, 30);
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO, deutsches Datum (TT.MM.JJJJ) oder Excel-Seriennummer → ISO; leer → undefined; ungültig → null. */
export function parseDate(s: string): string | undefined | null {
  const v = s.trim();
  if (!v) return undefined;
  if (isIsoDate(v)) return v;
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n >= 20000 && n <= 80000) return excelSerialToIso(n);
  }
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

const TOPIC_ALIASES: Record<string, string[]> = {
  title: ["title", "titel", "projekt", "thema", "bezeichnung"],
  shortName: ["shortName", "kürzel"],
  type: ["type", "typ", "art"],
  from: ["from", "von", "beginn", "start"],
  to: ["to", "bis", "ende", "end"],
  lead: ["lead", "federführung", "federführend", "leitung"],
  members: ["members", "mitwirkung", "mitwirkend", "beteiligte"],
  note: ["note", "notiz"],
};

export interface TopicCsvResult {
  topics: Topic[];
  issues: CsvIssue[];
}

/** Projekte aus CSV; Beteiligte über Kürzel, Name oder ID (getrennt durch „,“ oder „|“). */
export function importTopicsCsv(text: string, doc: Pick<OrgDocument, "units" | "topics">): TopicCsvResult {
  return importTopicsRows(parseCsv(text), doc);
}

/** Projekte aus Tabellenzeilen (CSV oder XLSX). */
export function importTopicsRows(
  rows: string[][],
  doc: Pick<OrgDocument, "units" | "topics">,
): TopicCsvResult {
  rows = rows.filter((r) => r.some((x) => x.trim() !== ""));
  const issues: CsvIssue[] = [];
  const col = headerIndex(rows[0] ?? [], TOPIC_ALIASES);
  if (!col.has("title")) return { topics: [], issues: [{ code: "missingColumn", column: "title" }] };
  const get = (r: string[], k: string) => {
    const i = col.get(k);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };
  const lookup = new Map<string, Id>();
  for (const u of doc.units) {
    lookup.set(u.id, u.id);
    if (!lookup.has(norm(u.name))) lookup.set(norm(u.name), u.id);
  }
  for (const u of doc.units) if (u.shortName) lookup.set(norm(u.shortName), u.id);
  const resolve = (v: string) => lookup.get(v) ?? lookup.get(norm(v));

  const topics: Topic[] = [];
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const title = get(r, "title");
    if (!title) {
      issues.push({ code: "emptyName", row: rowNo });
      return;
    }
    const rawType = get(r, "type");
    let type = parseTopicType(rawType);
    if (!type) {
      issues.push({ code: "unknownType", row: rowNo, value: rawType });
      type = "other";
    }
    const period: Topic["period"] = {};
    for (const k of ["from", "to"] as const) {
      const v = parseDate(get(r, k));
      if (v === null) issues.push({ code: "invalidDate", row: rowNo, value: get(r, k) });
      else if (v) period[k] = v;
    }
    if (period.from && period.to && period.from > period.to) {
      issues.push({ code: "invalidDate", row: rowNo, value: `${period.from} > ${period.to}` });
      delete period.to;
    }
    const participants: { unitId: Id; role: ParticipantRole }[] = [];
    const add = (list: string, role: ParticipantRole) => {
      for (const part of list
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        const id = resolve(part);
        if (!id) issues.push({ code: "unknownUnit", row: rowNo, value: part });
        else if (!participants.some((p) => p.unitId === id)) participants.push({ unitId: id, role });
      }
    };
    add(get(r, "lead"), "lead");
    add(get(r, "members"), "member");
    const idx = doc.topics.length + topics.length;
    const topic: Topic = {
      id: newId("t"),
      title,
      type,
      period,
      participants,
      color: TOPIC_PALETTE[idx % TOPIC_PALETTE.length]!,
    };
    const sn = get(r, "shortName");
    if (sn) topic.shortName = sn;
    const note = get(r, "note");
    if (note) topic.note = note;
    topics.push(topic);
  });
  return { topics, issues };
}

/** OEs als CSV. Besetzung und Stellennummer nur bei eingeschalteter Option (§12). */
export function exportUnitsCsv(
  doc: OrgDocument,
  label: Pick<LabelOptions, "holder" | "positionNumber">,
  unitIds?: ReadonlySet<Id>,
): string {
  const rows: string[][] = [[...UNIT_COLUMNS, "responsibilities", "isStaff", "note"]];
  for (const u of doc.units) {
    if (unitIds && !unitIds.has(u.id)) continue;
    rows.push([
      u.id,
      u.parentId && (!unitIds || unitIds.has(u.parentId)) ? u.parentId : "",
      u.name,
      u.shortName ?? "",
      u.type ?? "",
      u.lead?.title ?? "",
      u.lead?.code ?? "",
      label.positionNumber ? (u.lead?.positionNumber ?? "") : "",
      label.holder ? (u.lead?.holder ?? "") : "",
      u.responsibilities ?? "",
      u.isStaff ? "1" : "",
      u.note ?? "",
    ]);
  }
  return toCsv(rows);
}

export function exportTopicsCsv(doc: OrgDocument, topicIds?: ReadonlySet<Id>): string {
  const label = (id: Id) => {
    const u = doc.units.find((x) => x.id === id);
    return u ? (u.shortName ?? u.name) : id;
  };
  const rows: string[][] = [["title", "shortName", "type", "from", "to", "lead", "members", "note"]];
  for (const t of doc.topics) {
    if (topicIds && !topicIds.has(t.id)) continue;
    rows.push([
      t.title,
      t.shortName ?? "",
      t.type,
      t.period.from ?? "",
      t.period.to ?? "",
      t.participants
        .filter((p) => p.role === "lead")
        .map((p) => label(p.unitId))
        .join(", "),
      t.participants
        .filter((p) => p.role === "member")
        .map((p) => label(p.unitId))
        .join(", "),
      t.note ?? "",
    ]);
  }
  return toCsv(rows);
}
