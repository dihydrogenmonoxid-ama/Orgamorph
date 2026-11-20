// Browser-Speicher (ADR 0004): IndexedDB, Fallback localStorage. Schlüssel immer mit Dokument-ID (§5.1).

const DB_NAME = "orgamorph";
const DB_VERSION = 1;
const LS_PREFIX = "orgamorph:";

export interface StoredDoc {
  id: string;
  title: string;
  json: string;
  savedAt: string;
}

export interface RecentFile {
  docId: string;
  name: string;
  handle: unknown; // FileSystemFileHandle
  openedAt: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ["docs", "recent", "meta"])
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error("noIndexedDb"));
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(LS_PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export async function saveDoc(entry: StoredDoc): Promise<void> {
  try {
    await tx("docs", "readwrite", (s) => s.put(entry, entry.id));
    await tx("meta", "readwrite", (s) => s.put(entry.id, "lastDocId"));
  } catch {
    if (!lsSet(`doc:${entry.id}`, JSON.stringify(entry))) throw new Error("storageUnavailable");
    lsSet("lastDocId", entry.id);
  }
}

export async function loadDoc(id: string): Promise<StoredDoc | null> {
  try {
    const r = await tx<StoredDoc | undefined>("docs", "readonly", (s) => s.get(id));
    if (r) return r;
  } catch {
    /* Fallback */
  }
  const raw = lsGet(`doc:${id}`);
  return raw ? (JSON.parse(raw) as StoredDoc) : null;
}

export async function listDocs(): Promise<StoredDoc[]> {
  const out: StoredDoc[] = [];
  try {
    out.push(...(await tx<StoredDoc[]>("docs", "readonly", (s) => s.getAll())));
  } catch {
    /* Fallback */
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${LS_PREFIX}doc:`)) {
        const e = JSON.parse(localStorage.getItem(k)!) as StoredDoc;
        if (!out.some((x) => x.id === e.id)) out.push(e);
      }
    }
  } catch {
    /* ignorieren */
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function deleteDoc(id: string): Promise<void> {
  try {
    await tx("docs", "readwrite", (s) => s.delete(id));
  } catch {
    /* ignorieren */
  }
  try {
    localStorage.removeItem(`${LS_PREFIX}doc:${id}`);
  } catch {
    /* ignorieren */
  }
}

export async function lastDocId(): Promise<string | null> {
  try {
    const r = await tx<string | undefined>("meta", "readonly", (s) => s.get("lastDocId"));
    if (r) return r;
  } catch {
    /* Fallback */
  }
  return lsGet("lastDocId");
}

export async function saveRecent(entry: RecentFile): Promise<void> {
  try {
    await tx("recent", "readwrite", (s) => s.put(entry, entry.docId));
  } catch {
    /* Handles lassen sich nur in IndexedDB speichern */
  }
}

export async function listRecent(): Promise<RecentFile[]> {
  try {
    const all = await tx<RecentFile[]>("recent", "readonly", (s) => s.getAll());
    return all.sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1)).slice(0, 8);
  } catch {
    return [];
  }
}

/** Bittet den Browser, den Speicher nicht automatisch zu räumen (best effort). */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignorieren */
  }
}
