// Öffnen, Speichern, Neu, Beispiele, Importe. Verbindet Store, Autosave und Datei-Zugriff.

import behoerde from "../../examples/beispiel-behoerde-kgst.orgamorph.json";
import firma from "../../examples/beispiel-firma.orgamorph.json";
import { insertTopics, insertUnits } from "../core/commands.ts";
import { type CsvIssue, importTopicsRows, importUnitsRows } from "../core/io/csv.ts";
import { ParseError, parse, serialize } from "../core/io/json.ts";
import { ensureSingleRoot, parseOutline } from "../core/io/outline.ts";
import { exampleCsv, templateXlsx } from "../core/io/templates.ts";
import { emptyDocument, type Id, newId, type OrgDocument, type OrgUnit } from "../core/model.ts";
import { downloadBlob, downloadText, safeFileName } from "../export/download.ts";
import { lang, t } from "../i18n/index.ts";
import { autosaver, saveMode } from "../persistence/autosave.ts";
import { type RecentFile, requestPersistence, saveRecent } from "../persistence/browserStore.ts";
import {
  ensurePermission,
  type FileHandle,
  fsSupported,
  pickOpenFile,
  pickSaveFile,
  readHandle,
} from "../persistence/fsAccess.ts";
import { dialog, doc, loadDocument, loaded, notify, readOnly, run, select } from "./store.ts";

export const EXAMPLES = [
  { key: "behoerde", data: behoerde },
  { key: "firma", data: firma },
] as const;

export type ExampleKey = (typeof EXAMPLES)[number]["key"];

/** Neues Dokument ohne Datei: Browser-Modus. */
function openFresh(d: OrgDocument): void {
  autosaver.setFile(null);
  loadDocument(d);
  autosaver.schedule(d);
  void requestPersistence();
}

export function newDocument(): void {
  const d = emptyDocument(t("document.newTitle"), t("unit.rootName"));
  openFresh(d);
  select({ kind: "unit", id: d.units[0]!.id });
}

export function openExample(key: ExampleKey): void {
  const ex = EXAMPLES.find((e) => e.key === key)!;
  const { doc: d } = parse(JSON.stringify(ex.data));
  // Eigene Kopie: neue Dokument-ID, damit Änderungen das Beispiel nicht überschreiben
  openFresh({ ...d, id: newId("d") });
}

function parseOrNotify(text: string): ReturnType<typeof parse> | null {
  try {
    return parse(text);
  } catch (e) {
    if (e instanceof ParseError) notify(t(`parse.${e.code}`), "signal", 6000);
    else notify(t("parse.notJson"), "signal", 6000);
    return null;
  }
}

/** Öffnen aus Text (Dateiauswahl im Browser-Modus oder Browser-Speicher). */
export function openText(
  text: string,
  handle: FileHandle | null = null,
  lastModified: number | null = null,
): boolean {
  const r = parseOrNotify(text);
  if (!r) return false;
  autosaver.setFile(handle, lastModified);
  loadDocument(r.doc, { readOnly: r.readOnly });
  autosaver.markSaved(r.doc);
  if (r.readOnly) notify(t("notice.newerSchema"), "signal", 8000);
  if (handle)
    void saveRecent({ docId: r.doc.id, name: handle.name, handle, openedAt: new Date().toISOString() });
  return true;
}

/** Strg+O: Datei-Modus über Picker, sonst Dateiauswahl. */
export async function openFile(): Promise<void> {
  if (fsSupported()) {
    try {
      const h = await pickOpenFile();
      if (!h) return;
      const { text, lastModified } = await readHandle(h);
      openText(text, h, lastModified);
    } catch {
      notify(t("notice.openFailed"), "signal");
    }
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (f) openText(await f.text());
  };
  input.click();
}

export async function openRecent(r: RecentFile): Promise<void> {
  const h = r.handle as FileHandle;
  try {
    if (!(await ensurePermission(h))) {
      notify(t("notice.permissionDenied"), "signal");
      return;
    }
    const { text, lastModified } = await readHandle(h);
    openText(text, h, lastModified);
  } catch {
    notify(t("notice.openFailed"), "signal");
  }
}

/** Strg+S: Speicherort festlegen (Datei-Modus) bzw. als Datei sichern (Browser-Modus). */
export async function saveNow(): Promise<void> {
  if (saveMode.value === "file") {
    await autosaver.flush();
    notify(t("notice.saved"));
    return;
  }
  await saveAs();
}

export async function saveAs(asCopy = false): Promise<void> {
  let d = doc.value;
  if (asCopy) {
    d = { ...d, id: newId("d") };
    loadDocument(d);
  }
  const name = `${safeFileName(d.meta.title)}.orgamorph.json`;
  if (fsSupported()) {
    try {
      const h = await pickSaveFile(name);
      if (!h) return;
      autosaver.setFile(h, null);
      await autosaver.forceWrite(doc.value);
      const { lastModified } = await readHandle(h);
      autosaver.setFile(h, lastModified);
      void saveRecent({ docId: d.id, name: h.name, handle: h, openedAt: new Date().toISOString() });
      notify(t("notice.fileMode", { name: h.name }));
    } catch {
      notify(t("notice.saveFailed"), "signal");
    }
    return;
  }
  downloadText(serialize(d), name, "application/json");
}

/** Konflikt (§10.2): Neu laden. */
export async function conflictReload(): Promise<void> {
  const h = autosaver.fileHandle;
  if (!h) return;
  const { text, lastModified } = await readHandle(h);
  openText(text, h, lastModified);
  dialog.value = null;
}

export async function conflictKeepMine(): Promise<void> {
  await autosaver.forceWrite(doc.value);
  dialog.value = null;
}

export async function conflictSaveCopy(): Promise<void> {
  dialog.value = null;
  await saveAs(true);
}

/** Zur Startseite: vorher speichern (Datei- oder Browser-Modus). */
export async function goHome(): Promise<void> {
  if (!readOnly.value) {
    await autosaver.flush();
    notify(t("notice.saved"));
  }
  dialog.value = null;
  loaded.value = false;
}

// ---------- Vorlagen ----------

export function downloadExampleCsv(): void {
  const en = lang.value === "en";
  downloadText(exampleCsv(en), en ? "example-units.csv" : "beispiel-einheiten.csv", "text/csv");
}

export function downloadTemplateXlsx(): void {
  const en = lang.value === "en";
  downloadBlob(
    new Blob([templateXlsx(en) as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    en ? "template-structure.xlsx" : "vorlage-struktur.xlsx",
  );
}

// ---------- Importe ----------

export function issueTexts(issues: readonly CsvIssue[]): string[] {
  return issues.map((i) =>
    t(`csvIssue.${i.code}`, {
      ...("row" in i ? { row: i.row } : {}),
      ...("value" in i ? { value: i.value } : {}),
      ...("column" in i ? { column: i.column } : {}),
    }),
  );
}

export interface ImportResult {
  count: number;
  issues: string[];
}

export function importOutlineUnder(parentId: Id, text: string): number {
  const { units } = parseOutline(text);
  if (!units.length) return 0;
  return run(insertUnits(parentId, units)) ? units.length : 0;
}

/** Neues Dokument aus Tabellenzeilen (CSV oder XLSX). */
export function importUnitsRowsAsNew(rows: string[][], title?: string): ImportResult {
  const { units, issues } = importUnitsRows(rows);
  if (!units.length) return { count: 0, issues: issueTexts(issues) };
  const all: OrgUnit[] = ensureSingleRoot(units, t("unit.rootName"));
  const d = emptyDocument(title || all.find((u) => u.parentId === null)!.name);
  d.units = all;
  openFresh(d);
  return { count: all.length, issues: issueTexts(issues) };
}

/** Einheiten aus Tabellenzeilen unter `parentId` einfügen (ein Undo-Schritt). */
export function importUnitsRowsUnder(parentId: Id, rows: string[][]): ImportResult {
  const { units, issues } = importUnitsRows(rows);
  if (!units.length) return { count: 0, issues: issueTexts(issues) };
  return { count: run(insertUnits(parentId, units)) ? units.length : 0, issues: issueTexts(issues) };
}

export function importTopicsRowsInto(rows: string[][]): ImportResult {
  const { topics, issues } = importTopicsRows(rows, doc.value);
  if (topics.length && !run(insertTopics(topics))) return { count: 0, issues: [] };
  return { count: topics.length, issues: issueTexts(issues) };
}
