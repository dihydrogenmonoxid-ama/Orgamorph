// Undo/Redo: Liste unveränderlicher Dokument-Wurzeln mit strukturellem Teilen.
// Undo betrifft Daten und angeheftete Positionen, nicht Sicht, Filter, Zoom oder Auswahl.

import { type Draft, produce } from "immer";
import type { Command } from "./commands.ts";
import type { OrgDocument, ViewState } from "./model.ts";

export const HISTORY_LIMIT = 300;
export const COALESCE_MS = 1000;

export interface History {
  readonly past: readonly OrgDocument[];
  readonly present: OrgDocument;
  readonly future: readonly OrgDocument[];
  readonly lastKey: string | null;
  readonly lastTime: number;
  /** Labels der Schritte in `past` (für Tooltips „Rückgängig: …“) */
  readonly pastLabels: readonly string[];
  readonly futureLabels: readonly string[];
}

export function createHistory(doc: OrgDocument): History {
  return { past: [], present: doc, future: [], lastKey: null, lastTime: 0, pastLabels: [], futureLabels: [] };
}

/**
 * Führt einen Command aus. Wirft `CommandRejected`, wenn der Command abgelehnt wird.
 * Ändert der Command nichts, bleibt die History unverändert.
 */
export function execute(h: History, cmd: Command, now: number = Date.now()): History {
  const next = produce(h.present, (d) => {
    cmd.recipe(d);
  });
  if (next === h.present) return h;
  const stamped = produce(next, (d) => {
    d.meta.modified = new Date(now).toISOString();
  });
  const coalesce =
    cmd.coalesceKey !== undefined && cmd.coalesceKey === h.lastKey && now - h.lastTime < COALESCE_MS;
  if (coalesce) {
    return { ...h, present: stamped, future: [], futureLabels: [], lastTime: now };
  }
  const past = [...h.past, h.present];
  const pastLabels = [...h.pastLabels, cmd.label];
  if (past.length > HISTORY_LIMIT) {
    past.shift();
    pastLabels.shift();
  }
  return {
    past,
    pastLabels,
    present: stamped,
    future: [],
    futureLabels: [],
    lastKey: cmd.coalesceKey ?? null,
    lastTime: now,
  };
}

/** Übernimmt Sicht/Filter aus `current`, angeheftete Positionen aus `target`. */
function withView(target: OrgDocument, current: OrgDocument): OrgDocument {
  if (target.view === current.view) return target;
  const pinned = target.view.network.pinned;
  return produce(target, (d) => {
    d.view = { ...current.view, network: { ...current.view.network, pinned } } as Draft<ViewState>;
  });
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}
export function canRedo(h: History): boolean {
  return h.future.length > 0;
}

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1];
  if (!prev) return h;
  return {
    past: h.past.slice(0, -1),
    pastLabels: h.pastLabels.slice(0, -1),
    present: withView(prev, h.present),
    future: [h.present, ...h.future],
    futureLabels: [h.pastLabels[h.pastLabels.length - 1] ?? "", ...h.futureLabels],
    lastKey: null,
    lastTime: 0,
  };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next) return h;
  return {
    past: [...h.past, h.present],
    pastLabels: [...h.pastLabels, h.futureLabels[0] ?? ""],
    present: withView(next, h.present),
    future: h.future.slice(1),
    futureLabels: h.futureLabels.slice(1),
    lastKey: null,
    lastTime: 0,
  };
}

/** Ändert nur die Sicht (Modus, Filter, Beschriftung). Kein Undo-Schritt, `modified` bleibt. */
export function setView(h: History, recipe: (view: Draft<ViewState>) => void): History {
  const present = produce(h.present, (d) => {
    recipe(d.view);
  });
  return present === h.present ? h : { ...h, present };
}

/** Ersetzt das Dokument (Öffnen, Neu laden). Leert die History. */
export function replaceDocument(doc: OrgDocument): History {
  return createHistory(doc);
}
