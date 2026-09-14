import type { Call } from "./types";

/**
 * Recorded calls live in the reviewer's own browser.
 *
 * There is no database and no blob storage — an earlier decision that still holds. That also
 * happens to be the honest behaviour: a recording someone makes on a public demo should not show
 * up in a stranger's library.
 */

const DB = "fathom-recordings";
const STORE = "calls";
const VERSION = 1;

interface StoredRecording {
  id: string;
  call: Omit<Call, "audioUrl">;
  audio: Blob;
  createdAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function saveRecording(call: Omit<Call, "audioUrl">, audio: Blob): Promise<void> {
  await tx("readwrite", (s) =>
    s.put({ id: call.id, call, audio, createdAt: Date.now() } satisfies StoredRecording),
  );
}

export async function listRecordings(): Promise<Omit<Call, "audioUrl">[]> {
  try {
    const all = await tx<StoredRecording[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt).map((r) => r.call);
  } catch {
    // Private windows and blocked storage are normal, not exceptional.
    return [];
  }
}

/** Returns the call with a blob: URL the player can use. Caller revokes it when done. */
export async function loadRecording(id: string): Promise<Call | null> {
  try {
    const rec = await tx<StoredRecording | undefined>("readonly", (s) => s.get(id));
    if (!rec) return null;
    return { ...rec.call, audioUrl: URL.createObjectURL(rec.audio) };
  } catch {
    return null;
  }
}

export async function deleteRecording(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
