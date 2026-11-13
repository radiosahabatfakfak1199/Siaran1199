const DB_NAME = 'radio-lokal';
const DB_VERSION = 1;
const STORE = 'tracks';

export type StoredTrack = {
  id: string;
  blob: Blob;
  addedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
        work(tx.objectStore(STORE));
      }),
  );
}

export function loadStoredTracks(): Promise<StoredTrack[]> {
  return openDb().then(
    (db) =>
      new Promise<StoredTrack[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        tx.oncomplete = () => {
          db.close();
          const records = (request.result as StoredTrack[]).slice().sort((a, b) => a.addedAt - b.addedAt);
          resolve(records);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export function saveStoredTrack(record: StoredTrack): Promise<void> {
  return transact('readwrite', (store) => {
    store.put(record);
  });
}

export function deleteStoredTracks(ids: string[]): Promise<void> {
  return transact('readwrite', (store) => {
    ids.forEach((id) => store.delete(id));
  });
}

export function clearStoredTracks(): Promise<void> {
  return transact('readwrite', (store) => {
    store.clear();
  });
}
