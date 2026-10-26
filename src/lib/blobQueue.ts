/**
 * A tiny IndexedDB queue for work that carries blobs and must survive a reload: captures taken
 * offline wait here until the connection returns (FEATURES.md 5.13, offline).
 */

export type QueuedItem<T> = {
  id: string;
  createdAt: number;
  blobs: Blob[];
  meta: T;
  /** Times the server refused it; network failures do not count. */
  attempts?: number;
};

const STORE = "items";

function open(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<R>(
  dbName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<R>,
) {
  const db = await open(dbName);
  try {
    return await new Promise<R>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function blobQueue<T>(dbName: string) {
  return {
    add: (blobs: Blob[], meta: T) =>
      run(dbName, "readwrite", (s) =>
        s.put({ id: crypto.randomUUID(), createdAt: Date.now(), blobs, meta } satisfies QueuedItem<T>),
      ),
    list: () => run<QueuedItem<T>[]>(dbName, "readonly", (s) => s.getAll() as IDBRequest<QueuedItem<T>[]>),
    remove: (id: string) => run(dbName, "readwrite", (s) => s.delete(id)),
    update: (item: QueuedItem<T>) => run(dbName, "readwrite", (s) => s.put(item)),
  };
}
