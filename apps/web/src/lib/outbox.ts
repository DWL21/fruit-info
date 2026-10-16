// 촬영한 사진을 업로드가 끝날 때까지 기기(IndexedDB)에 보관한다.
// 시장 안 전파가 약하거나 페이지가 닫혀도 다시 열면 이어서 올린다.
export interface OutboxItem {
  id: string;
  storeId: number;
  storeName: string;
  blob: Blob;
  takenAt: string;
  autoStore: boolean;
}

const DB = 'fruit-shoot';
const STORE = 'outbox';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 메모리 큐만 쓴다.
export const outbox = {
  put: (item: OutboxItem) => run('readwrite', (s) => s.put(item)).catch(() => undefined),
  remove: (id: string) => run('readwrite', (s) => s.delete(id)).catch(() => undefined),
  all: () => run<OutboxItem[]>('readonly', (s) => s.getAll()).catch(() => [] as OutboxItem[]),
};
