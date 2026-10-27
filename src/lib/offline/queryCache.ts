/**
 * The offline read cache (FEATURES.md 5.13, 8): the last result of every query a screen showed,
 * kept in memory and mirrored to IndexedDB, so recently viewed screens still read with no
 * connection. Loaded once before the app renders; bounded by entry count and entry size.
 */

const DB = "ft-query-cache";
const STORE = "entries";
const MAX_ENTRIES = 300;
/** Results bigger than this (as JSON) are not kept: a long player index is not worth the space. */
const MAX_CHARS = 750_000;
const WRITE_DELAY_MS = 800;

type Entry = { key: string; value: unknown; at: number };

const memory = new Map<string, Entry>();
const dirty = new Set<string>();
const evicted = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Loads the saved entries into memory. Never throws: without IndexedDB the cache is memory only. */
export async function hydrateQueryCache(): Promise<void> {
  try {
    const db = await open();
    const entries = await new Promise<Entry[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as Entry[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    for (const entry of entries.sort((a, b) => a.at - b.at)) memory.set(entry.key, entry);
  } catch {
    // Private browsing or storage disabled.
  }
}

async function persist() {
  timer = null;
  const writes = [...dirty].flatMap((key) => {
    const entry = memory.get(key);
    return entry && fitsOnDisk(entry.value) ? [entry] : [];
  });
  const deletes = [...evicted];
  dirty.clear();
  evicted.clear();
  try {
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const entry of writes) store.put(entry);
    for (const key of deletes) store.delete(key);
    db.close();
  } catch {
    // Storage full or unavailable: the memory copy still serves this session.
  }
}

export function readCachedQuery(key: string): unknown {
  return memory.get(key)?.value;
}

/** Keeps a query result, the newest last; the oldest go once the cache is full. */
export function writeCachedQuery(key: string, value: unknown): void {
  memory.delete(key);
  memory.set(key, { key, value, at: Date.now() });
  dirty.add(key);
  evicted.delete(key);
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
    dirty.delete(oldest);
    evicted.add(oldest);
  }
  timer ??= setTimeout(() => void persist(), WRITE_DELAY_MS);
}

/** Whether a result is small enough to keep on disk; bigger ones live in memory for the session. */
function fitsOnDisk(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= MAX_CHARS;
  } catch {
    return false;
  }
}

/** Forgets everything, on sign-out: the next account must not read the last one's data. */
export async function clearQueryCache(): Promise<void> {
  memory.clear();
  dirty.clear();
  evicted.clear();
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    db.close();
  } catch {
    // Nothing stored.
  }
}

/** True when anything is cached: someone signed in on this device before. */
export function hasCachedQueries(): boolean {
  return memory.size > 0;
}
