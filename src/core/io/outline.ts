// Gliederungstext ↔ Baum.
// Eingerückte Liste (Tab, 2 Leerzeichen, „-“, „*“, „•“), optional „Kürzel | Name“ pro Zeile.

import { childIndex, type Id, newId, type OrgDocument, type OrgUnit } from "../model.ts";

export interface OutlineResult {
  /** OEs in Tiefensuche-Reihenfolge; oberste Ebene hat `parentId: null` */
  units: OrgUnit[];
  /** Zeilennummern (1-basiert), deren Einrückung um mehr als eine Ebene sprang und angepasst wurde */
  adjustedLines: number[];
}

const BULLET = /^([-*•–]|\d+[.)])\s+/;

function indentLevel(raw: string): { level: number; rest: string } {
  let i = 0;
  let cols = 0;
  while (i < raw.length && (raw[i] === " " || raw[i] === "\t")) {
    cols += raw[i] === "\t" ? 2 : 1;
    i++;
  }
  return { level: Math.floor(cols / 2), rest: raw.slice(i) };
}

export function parseLine(text: string): { name: string; shortName?: string } {
  const clean = text.replace(BULLET, "").trim();
  const bar = clean.indexOf("|");
  if (bar >= 0) {
    const shortName = clean.slice(0, bar).trim();
    const name = clean.slice(bar + 1).trim();
    if (name && shortName) return { name, shortName };
    return { name: name || shortName };
  }
  return { name: clean };
}

export function parseOutline(text: string, makeId: () => Id = () => newId("u")): OutlineResult {
  const units: OrgUnit[] = [];
  const adjustedLines: number[] = [];
  const stack: { level: number; id: Id }[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const { level: rawLevel, rest } = indentLevel(raw);
    const { name, shortName } = parseLine(rest);
    if (!name) return;
    const prevLevel = stack.length ? stack[stack.length - 1]!.level : -1;
    let level = rawLevel;
    if (level > prevLevel + 1) {
      level = prevLevel + 1;
      adjustedLines.push(idx + 1);
    }
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1]!.id : null;
    const unit: OrgUnit = { id: makeId(), parentId, name, ...(shortName ? { shortName } : {}) };
    units.push(unit);
    stack.push({ level, id: unit.id });
  });
  return { units, adjustedLines };
}

/** Hängt mehrere oberste Einträge unter eine gemeinsame Wurzel, damit es genau eine Wurzel gibt. */
export function ensureSingleRoot(
  units: OrgUnit[],
  rootName: string,
  makeId: () => Id = () => newId("u"),
): OrgUnit[] {
  const tops = units.filter((u) => u.parentId === null);
  if (tops.length === 1) return units;
  const root: OrgUnit = { id: makeId(), parentId: null, name: rootName };
  return [root, ...units.map((u) => (u.parentId === null ? { ...u, parentId: root.id } : u))];
}

/** Dokument → Gliederungstext (2 Leerzeichen je Ebene, „Kürzel | Name“). */
export function toOutline(doc: Pick<OrgDocument, "units">, rootId?: Id): string {
  const idx = childIndex(doc.units);
  const out: string[] = [];
  const visit = (u: OrgUnit, level: number) => {
    const label = u.shortName && u.shortName !== u.name ? `${u.shortName} | ${u.name}` : u.name;
    out.push(`${"  ".repeat(level)}${label}`);
    for (const c of idx.get(u.id) ?? []) visit(c, level + 1);
  };
  const start = rootId ? doc.units.find((u) => u.id === rootId) : doc.units.find((u) => u.parentId === null);
  if (start) visit(start, 0);
  return `${out.join("\n")}\n`;
}
