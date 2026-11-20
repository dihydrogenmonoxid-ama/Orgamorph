// Anwendungszustand (Signals). Das Dokument ändert sich ausschließlich über Commands (§10.3).

import { batch, computed, signal } from "@preact/signals";
import type { Draft } from "immer";
import { computeMetrics } from "../core/analysis/metrics.ts";
import { type Command, CommandRejected } from "../core/commands.ts";
import { applyFilter, type FilteredGraph, restrictGraph } from "../core/filter.ts";
import { adjacency, neighbourhood } from "../core/graph.ts";
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  type History,
  redo as historyRedo,
  undo as historyUndo,
  setView,
} from "../core/history.ts";
import { buildScene, type Scene } from "../core/io/svg.ts";
import { emptyDocument, type Id, type OrgDocument, type ViewState } from "../core/model.ts";
import { validate } from "../core/validate.ts";
import { t } from "../i18n/index.ts";

export type Selection = { kind: "unit" | "topic" | "relation"; id: Id } | null;
export type LeftTab = "structure" | "topics" | "relations";
export type DialogName =
  | "help"
  | "about"
  | "import"
  | "export"
  | "print"
  | "matrix"
  | "document"
  | "conflict"
  | "open"
  | null;

export interface Notice {
  id: number;
  text: string;
  tone: "info" | "signal";
}

export const history = signal<History>(createHistory(emptyDocument()));
/** false = leerer Zustand (noch kein Dokument geöffnet) */
export const loaded = signal(false);
export const readOnly = signal(false);
export const selection = signal<Selection>(null);
export const leftTab = signal<LeftTab>("structure");
export const dialog = signal<DialogName>(null);
export const notices = signal<Notice[]>([]);
/** Lokaler Graph in der Netz-Sicht: 0 = aus, 1/2 = Tiefe */
export const localDepth = signal<0 | 1 | 2>(0);
/** Hervorgehobener Knoten (Hover) */
export const hovered = signal<string | null>(null);
/** OE, deren Name gerade inline bearbeitet wird */
export const renaming = signal<Id | null>(null);
/** Einheit, deren Teilbaum im Struktur-Editor zugeklappt ist */
export const collapsed = signal<ReadonlySet<Id>>(new Set());

export const doc = computed<OrgDocument>(() => history.value.present);
export const undoAvailable = computed(() => canUndo(history.value));
export const redoAvailable = computed(() => canRedo(history.value));

let noticeId = 0;
export function notify(text: string, tone: Notice["tone"] = "info", ms = 4000): void {
  const n = { id: ++noticeId, text, tone };
  notices.value = [...notices.value, n];
  setTimeout(() => {
    notices.value = notices.value.filter((x) => x.id !== n.id);
  }, ms);
}

/** Führt einen Command aus. Gibt bei Neuanlage die ID zurück, bei Ablehnung `undefined`. */
export function run(cmd: Command): Id | undefined | true {
  if (readOnly.value) {
    notify(t("notice.readOnly"));
    return undefined;
  }
  try {
    history.value = execute(history.value, cmd);
    return cmd.createdId ?? true;
  } catch (e) {
    if (e instanceof CommandRejected) {
      const reason = e.reason.split(":")[0]!;
      notify(t(`reject.${reason}`));
      return undefined;
    }
    throw e;
  }
}

export function undo(): void {
  history.value = historyUndo(history.value);
  fixSelection();
}

export function redo(): void {
  history.value = historyRedo(history.value);
  fixSelection();
}

/** Sichtänderung (kein Undo-Schritt). */
export function updateView(recipe: (v: Draft<ViewState>) => void): void {
  history.value = setView(history.value, recipe);
}

/** Auswahl aufheben, wenn das ausgewählte Objekt nicht mehr existiert. */
function fixSelection(): void {
  const s = selection.value;
  if (!s) return;
  const d = doc.value;
  const exists =
    s.kind === "unit"
      ? d.units.some((u) => u.id === s.id)
      : s.kind === "topic"
        ? d.topics.some((x) => x.id === s.id)
        : d.relations.some((r) => r.id === s.id);
  if (!exists) selection.value = null;
}

export function loadDocument(next: OrgDocument, opts: { readOnly?: boolean } = {}): void {
  batch(() => {
    history.value = createHistory(next);
    readOnly.value = !!opts.readOnly;
    selection.value = null;
    renaming.value = null;
    collapsed.value = new Set();
    localDepth.value = 0;
    loaded.value = true;
  });
}

export function select(sel: Selection): void {
  selection.value = sel;
  if (sel?.kind === "unit") leftTab.value = leftTab.value === "structure" ? "structure" : leftTab.value;
}

export const selectedUnitId = computed(() => (selection.value?.kind === "unit" ? selection.value.id : null));

// ---------- Abgeleitete Daten ----------

export const filtered = computed<FilteredGraph>(() => applyFilter(doc.value, doc.value.view.filter));

/** Teilgraph der Darstellung (ggf. lokaler Graph in der Netz-Sicht). */
export const displayed = computed<FilteredGraph>(() => {
  const g = filtered.value;
  const d = doc.value;
  const center = selectedUnitId.value;
  if (d.view.mode !== "network" || localDepth.value === 0 || !center || !g.unitIds.has(center)) return g;
  return restrictGraph(g, neighbourhood(adjacency(g), center, localDepth.value));
});

export const sceneFor = (
  mode: ViewState["mode"],
  g: FilteredGraph,
  d: OrgDocument,
  label = d.view.label,
): Scene =>
  buildScene(d, g, {
    mode,
    label,
    tree: d.view.tree,
    pinned: d.view.network.pinned,
    externalCount: (n) => t("external.count", { n }),
  });

export const scene = computed<Scene>(() => sceneFor(doc.value.view.mode, displayed.value, doc.value));

export const metrics = computed(() => computeMetrics(filtered.value, doc.value.settings.spanOfControlHint));

export const issues = computed(() => validate(doc.value));

/** Nächstgelegener Eltern-/Geschwisterknoten nach dem Löschen (für die Tastaturbedienung). */
export function neighbourAfterDelete(id: Id): Id | null {
  const d = doc.value;
  const u = d.units.find((x) => x.id === id);
  if (!u?.parentId) return null;
  const sibs = d.units.filter((x) => x.parentId === u.parentId);
  const i = sibs.findIndex((x) => x.id === id);
  return sibs[i + 1]?.id ?? sibs[i - 1]?.id ?? u.parentId;
}

export { canRedo, canUndo };
