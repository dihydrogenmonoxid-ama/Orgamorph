// Migrationen zwischen Schemaversionen. Version 1 ist die erste; die Funktion
// normalisiert zusätzlich fehlende optionale Blöcke (settings, view, id).

import { defaultSettings, defaultView, newId, nowIso, SCHEMA_VERSION } from "./model.ts";

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Ergänzt fehlende Blöcke mit Defaults; behält alle unbekannten Felder. */
export function migrate(raw: Json): Json {
  const out: Json = { ...raw };
  // Schritte vN → vN+1 kommen hier hinzu, sobald es Version 2 gibt.
  if (typeof out.id !== "string") out.id = newId("d");
  const meta = isObj(out.meta) ? { ...out.meta } : {};
  if (typeof meta.title !== "string") meta.title = "";
  if (typeof meta.created !== "string") meta.created = nowIso();
  if (typeof meta.modified !== "string") meta.modified = meta.created;
  out.meta = meta;
  for (const key of ["units", "topics", "relations"]) if (!Array.isArray(out[key])) out[key] = [];
  out.topics = (out.topics as unknown[]).map((t) => {
    if (!isObj(t)) return t;
    return {
      ...t,
      period: isObj(t.period) ? t.period : {},
      participants: Array.isArray(t.participants) ? t.participants : [],
    };
  });
  out.settings = { ...defaultSettings(), ...(isObj(out.settings) ? out.settings : {}) };
  out.view = mergeView(isObj(out.view) ? out.view : {});
  return out;
}

function mergeView(v: Json): Json {
  const d = defaultView() as unknown as Json;
  const sub = (k: string) => ({ ...(d[k] as Json), ...(isObj(v[k]) ? (v[k] as Json) : {}) });
  return {
    ...d,
    ...v,
    label: sub("label"),
    filter: sub("filter"),
    tree: sub("tree"),
    network: { pinned: isObj((v.network as Json | undefined)?.pinned) ? (v.network as Json).pinned : {} },
  };
}

export function isNewerSchema(version: unknown): boolean {
  return typeof version === "number" && version > SCHEMA_VERSION;
}
