// Autosave (§10.2): Debounce 500 ms, Flush bei visibilitychange/pagehide, Konflikterkennung im Datei-Modus.

import { signal } from "@preact/signals";
import { serialize } from "../core/io/json.ts";
import type { OrgDocument } from "../core/model.ts";
import { saveDoc } from "./browserStore.ts";
import { ExternalChange, type FileHandle, writeHandle } from "./fsAccess.ts";

export const DEBOUNCE_MS = 500;

export type SaveState =
  | { kind: "saved"; at: Date }
  | { kind: "saving" }
  | { kind: "dirty" }
  | { kind: "error"; reason: "conflict" | "permission" | "storage" | "unknown" };

export type SaveMode = "file" | "browser";

export const saveState = signal<SaveState>({ kind: "saved", at: new Date() });
export const saveMode = signal<SaveMode>("browser");
export const fileName = signal<string | null>(null);

interface FileTarget {
  handle: FileHandle;
  lastModified: number | null;
}

export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: OrgDocument | null = null;
  private lastSaved: OrgDocument | null = null;
  private file: FileTarget | null = null;
  private writing: Promise<void> = Promise.resolve();
  onConflict: (() => void) | null = null;

  private readonly delay: number;

  constructor(delay = DEBOUNCE_MS) {
    this.delay = delay;
  }

  setFile(handle: FileHandle | null, lastModified: number | null = null): void {
    this.file = handle ? { handle, lastModified } : null;
    saveMode.value = handle ? "file" : "browser";
    fileName.value = handle?.name ?? null;
  }

  get fileHandle(): FileHandle | null {
    return this.file?.handle ?? null;
  }

  /** Neuer Stand: Speichern nach Debounce. */
  schedule(doc: OrgDocument): void {
    if (doc === this.lastSaved || doc === this.pending) return;
    this.pending = doc;
    if (saveState.value.kind !== "error") saveState.value = { kind: "dirty" };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  /** Markiert den Stand als gespeichert, ohne zu schreiben (nach Öffnen/Neu laden). */
  markSaved(doc: OrgDocument): void {
    this.lastSaved = doc;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    saveState.value = { kind: "saved", at: new Date() };
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const doc = this.pending;
    if (!doc) return this.writing;
    this.pending = null;
    this.writing = this.writing.then(() => this.write(doc));
    return this.writing;
  }

  /** Überschreibt trotz externer Änderung („Meine Version behalten“). */
  async forceWrite(doc: OrgDocument): Promise<void> {
    if (this.file) this.file.lastModified = null;
    saveState.value = { kind: "dirty" };
    this.pending = doc;
    await this.flush();
  }

  private async write(doc: OrgDocument): Promise<void> {
    saveState.value = { kind: "saving" };
    const json = serialize(doc);
    try {
      // Browser-Kopie immer (auch im Datei-Modus als Sicherung)
      await saveDoc({ id: doc.id, title: doc.meta.title, json, savedAt: new Date().toISOString() }).catch(
        (e) => {
          if (!this.file) throw e;
        },
      );
      if (this.file)
        this.file.lastModified = await writeHandle(this.file.handle, json, this.file.lastModified);
      this.lastSaved = doc;
      if (!this.pending) saveState.value = { kind: "saved", at: new Date() };
    } catch (e) {
      this.pending = this.pending ?? doc;
      if (e instanceof ExternalChange) {
        saveState.value = { kind: "error", reason: "conflict" };
        this.onConflict?.();
      } else if ((e as Error).name === "NotAllowedError") {
        saveState.value = { kind: "error", reason: "permission" };
      } else if ((e as Error).message === "storageUnavailable") {
        saveState.value = { kind: "error", reason: "storage" };
      } else {
        saveState.value = { kind: "error", reason: "unknown" };
      }
    }
  }

  /** Flush bei Seitenwechsel und Schließen. */
  installLifecycle(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.flush();
    });
    window.addEventListener("pagehide", () => void this.flush());
  }
}

export const autosaver = new Autosaver();
