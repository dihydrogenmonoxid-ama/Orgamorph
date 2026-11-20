// Invarianten. Fehler verletzen das Modell, Hinweise beschreiben nur Auffälligkeiten.

import {
  ancestorIds,
  type Id,
  isIsoDate,
  isValidLogo,
  type OrgDocument,
  RELATION_KINDS,
  TOPIC_TYPES,
} from "./model.ts";

export type IssueCode =
  | "noRoot"
  | "multipleRoots"
  | "missingParent"
  | "cycle"
  | "duplicateId"
  | "emptyName"
  | "missingParticipant"
  | "duplicateParticipant"
  | "missingRelationEnd"
  | "selfRelation"
  | "invalidPeriod"
  | "invalidDate"
  | "invalidType"
  | "duplicatePositionNumber"
  | "spanOfControl"
  | "invalidLogo";

export interface Issue {
  code: IssueCode;
  severity: "error" | "hint";
  /** Betroffene Objekte (OE-, Projekt- oder Beziehungs-IDs) */
  ids: Id[];
  /** Zusatzwert, z. B. die doppelte Stellennummer oder die Leitungsspanne */
  value?: string | number;
}

export function validate(doc: OrgDocument): Issue[] {
  const issues: Issue[] = [];
  const err = (code: IssueCode, ids: Id[], value?: string | number) =>
    issues.push({ code, severity: "error", ids, ...(value !== undefined ? { value } : {}) });
  const hint = (code: IssueCode, ids: Id[], value?: string | number) =>
    issues.push({ code, severity: "hint", ids, ...(value !== undefined ? { value } : {}) });

  // IDs eindeutig (über alle Objektarten)
  const seen = new Set<Id>();
  for (const obj of [...doc.units, ...doc.topics, ...doc.relations]) {
    if (seen.has(obj.id)) err("duplicateId", [obj.id]);
    seen.add(obj.id);
  }

  const unitIds = new Set(doc.units.map((u) => u.id));
  const roots = doc.units.filter((u) => u.parentId === null);
  if (roots.length === 0) err("noRoot", []);
  if (roots.length > 1)
    err(
      "multipleRoots",
      roots.map((r) => r.id),
    );

  for (const u of doc.units) {
    if (!u.name.trim()) err("emptyName", [u.id]);
    if (u.parentId !== null && !unitIds.has(u.parentId)) err("missingParent", [u.id]);
  }

  // Zyklen: Vorfahrenkette darf die OE nicht selbst erreichen; Kette endet an der Wurzel
  const byId = new Map(doc.units.map((u) => [u.id, u]));
  for (const u of doc.units) {
    let cur = u.parentId;
    const visited = new Set<Id>([u.id]);
    while (cur !== null) {
      if (visited.has(cur)) {
        err("cycle", [u.id]);
        break;
      }
      visited.add(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }
  }

  for (const t of doc.topics) {
    if (!(TOPIC_TYPES as readonly string[]).includes(t.type)) err("invalidType", [t.id], t.type);
    const { from, to } = t.period;
    if ((from !== undefined && !isIsoDate(from)) || (to !== undefined && !isIsoDate(to)))
      err("invalidDate", [t.id]);
    else if (from && to && from > to) err("invalidPeriod", [t.id]);
    const inTopic = new Set<Id>();
    for (const p of t.participants) {
      if (!unitIds.has(p.unitId)) err("missingParticipant", [t.id, p.unitId]);
      if (inTopic.has(p.unitId)) err("duplicateParticipant", [t.id, p.unitId]);
      inTopic.add(p.unitId);
    }
  }

  for (const r of doc.relations) {
    if (!(RELATION_KINDS as readonly string[]).includes(r.kind)) err("invalidType", [r.id], r.kind);
    if (!unitIds.has(r.from) || !unitIds.has(r.to)) err("missingRelationEnd", [r.id]);
    if (r.from === r.to) err("selfRelation", [r.id]);
  }

  // Hinweise
  if (doc.meta.logo !== undefined && !isValidLogo(doc.meta.logo)) hint("invalidLogo", []);
  const byPos = new Map<string, Id[]>();
  for (const u of doc.units) {
    const pn = u.lead?.positionNumber?.trim();
    if (!pn) continue;
    byPos.set(pn, [...(byPos.get(pn) ?? []), u.id]);
  }
  for (const [pn, ids] of byPos) if (ids.length > 1) hint("duplicatePositionNumber", ids, pn);

  const limit = doc.settings.spanOfControlHint;
  const span = new Map<Id, number>();
  for (const u of doc.units) if (u.parentId) span.set(u.parentId, (span.get(u.parentId) ?? 0) + 1);
  for (const [id, n] of span) if (n > limit) hint("spanOfControl", [id], n);

  return issues;
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.severity === "error");
}

/** Wirft, wenn das Dokument Invarianten verletzt. Für Commands und Tests. */
export function assertValid(doc: OrgDocument): void {
  const errors = errorsOf(validate(doc));
  if (errors.length) {
    throw new Error(`Ungültiges Dokument: ${errors.map((e) => `${e.code}(${e.ids.join(",")})`).join("; ")}`);
  }
}

/** Kann `unitId` unter `newParentId` gehängt werden? */
export function canReparent(doc: OrgDocument, unitId: Id, newParentId: Id): boolean {
  if (unitId === newParentId) return false;
  if (!doc.units.some((u) => u.id === newParentId)) return false;
  const unit = doc.units.find((u) => u.id === unitId);
  if (!unit || unit.parentId === null) return false; // Wurzel bleibt Wurzel
  return !ancestorIds(doc, newParentId).includes(unitId);
}
