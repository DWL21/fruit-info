import type { ItemSummary, Observation, Photo, Store, StoreInput, ObservationPatch } from '@fruit/shared';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다. 네트워크를 확인하세요.');
  }
  const body = (await res.json().catch(() => null)) as { data?: T; error?: { message: string } } | null;
  if (!res.ok || !body || !('data' in body)) throw new ApiError(res.status, body?.error?.message ?? `요청 실패 (${res.status})`);
  return body.data as T;
}

export interface ItemDetail {
  item: { slug: string; name: string; emoji: string };
  observations: Observation[];
  history: { day: string; min_price: number; stores: number }[];
}

export const api = {
  items: () => request<ItemSummary[]>('/api/items'),
  item: (slug: string) => request<ItemDetail>(`/api/items/${slug}`),
  stores: () => request<Store[]>('/api/stores'),
  store: (id: number) => request<{ store: Store; observations: Observation[]; photos: Photo[] }>(`/api/stores/${id}`),
  photo: (id: string) => request<{ photo: Photo; observations: Observation[] }>(`/api/photos/${id}`),
};

const KEY_STORAGE = 'fruit.uploadKey';
export const operatorKey = {
  get: () => {
    try {
      return localStorage.getItem(KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  },
  set: (v: string) => {
    try {
      if (v) localStorage.setItem(KEY_STORAGE, v);
      else localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* 저장 불가 환경 */
    }
  },
};

const adminInit = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers ?? {}), 'x-upload-key': operatorKey.get() },
});
const jsonInit = (method: string, body: unknown): RequestInit =>
  adminInit({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

export const adminApi = {
  verify: (key: string) => request<{ ok: true }>('/api/admin/verify', { method: 'POST', headers: { 'x-upload-key': key } }),
  photos: () => request<Photo[]>('/api/admin/photos', adminInit()),
  photo: (id: string) => request<{ photo: Photo; observations: Observation[] }>(`/api/admin/photos/${id}`, adminInit()),
  upload: (photo: Blob, storeId: number, takenAt: string, autoStore = false) => {
    const form = new FormData();
    form.set('photo', new File([photo], 'photo.jpg', { type: 'image/jpeg' }));
    form.set('storeId', String(storeId));
    form.set('takenAt', takenAt);
    if (autoStore) form.set('autoStore', '1');
    return request<Photo>('/api/admin/photos', adminInit({ method: 'POST', body: form }));
  },
  reanalyze: (id: string) => request<Photo>(`/api/admin/photos/${id}/reanalyze`, adminInit({ method: 'POST' })),
  createStore: (input: StoreInput) => request<Store>('/api/admin/stores', jsonInit('POST', input)),
  updateStore: (id: number, input: Partial<StoreInput>) => request<Store>(`/api/admin/stores/${id}`, jsonInit('PATCH', input)),
  deleteStore: (id: number) => request<{ ok: true }>(`/api/admin/stores/${id}`, adminInit({ method: 'DELETE' })),
  patchObservation: (id: number, patch: ObservationPatch) => request<{ ok: true }>(`/api/admin/observations/${id}`, jsonInit('PATCH', patch)),
};
