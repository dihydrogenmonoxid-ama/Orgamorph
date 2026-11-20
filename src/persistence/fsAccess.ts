// File System Access API (Chrome, Edge). Unter file:// verfügbar (ADR 0004).

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
}

export type { FileHandle };

type PickerWindow = Window & {
  showSaveFilePicker?: (o: unknown) => Promise<FileHandle>;
  showOpenFilePicker?: (o: unknown) => Promise<FileHandle[]>;
};

const TYPES = [{ description: "Orgamorph", accept: { "application/json": [".orgamorph.json", ".json"] } }];

export function fsSupported(): boolean {
  const w = globalThis as unknown as PickerWindow;
  return typeof w.showSaveFilePicker === "function" && typeof w.showOpenFilePicker === "function";
}

export async function pickSaveFile(suggestedName: string): Promise<FileHandle | null> {
  try {
    return await (window as PickerWindow).showSaveFilePicker!({ suggestedName, types: TYPES });
  } catch (e) {
    if ((e as Error).name === "AbortError") return null;
    throw e;
  }
}

export async function pickOpenFile(): Promise<FileHandle | null> {
  try {
    const [h] = await (window as PickerWindow).showOpenFilePicker!({ types: TYPES, multiple: false });
    return h ?? null;
  } catch (e) {
    if ((e as Error).name === "AbortError") return null;
    throw e;
  }
}

export async function ensurePermission(h: FileHandle): Promise<boolean> {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await h.requestPermission?.({ mode: "readwrite" })) === "granted";
}

export async function readHandle(h: FileHandle): Promise<{ text: string; lastModified: number }> {
  const f = await h.getFile();
  return { text: await f.text(), lastModified: f.lastModified };
}

export class ExternalChange extends Error {
  constructor() {
    super("externalChange");
    this.name = "ExternalChange";
  }
}

/**
 * Schreibt atomar über createWritable(). Prüft vorher lastModified: wurde die Datei extern geändert,
 * wird nicht geschrieben (§10.2). Gibt das neue lastModified zurück.
 */
export async function writeHandle(
  h: FileHandle,
  text: string,
  expectedLastModified: number | null,
): Promise<number> {
  if (expectedLastModified !== null) {
    const f = await h.getFile();
    if (f.lastModified !== expectedLastModified) throw new ExternalChange();
  }
  const w = await h.createWritable();
  await w.write(text);
  await w.close();
  return (await h.getFile()).lastModified;
}
