export type VoiceNote = {
  id: string;
  createdAt: string;
  durationSeconds: number;
  audio: Blob;
};

const databaseName = "offload-brain-drop";
const storeName = "voice-notes";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function listVoiceNotes() {
  const notes = await runRequest<VoiceNote[]>("readonly", store => store.getAll());
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveVoiceNote(note: VoiceNote) {
  await runRequest<IDBValidKey>("readwrite", store => store.put(note));
}

export async function removeVoiceNote(id: string) {
  await runRequest<undefined>("readwrite", store => store.delete(id));
}
