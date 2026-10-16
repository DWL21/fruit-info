import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AISLES, CATALOG, placeName, sideName, timeAgo, won, type Aisle, type Photo, type Side, type Store } from '@fruit/shared';
import { adminApi, api, operatorKey, type ApiError } from '../lib/api.ts';
import { Link } from '../components/Link.tsx';
import { track } from '../lib/analytics.ts';
import { outbox } from '../lib/outbox.ts';

/** 촬영 결과를 최대 2560px JPEG로 만든다. 캔버스를 거치며 EXIF(GPS 등)가 제거된다. */
async function toJpeg(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const scale = Math.min(1, 2560 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진 변환 실패'))), 'image/jpeg', 0.9));
}

interface Job {
  id: string;
  storeId: number;
  storeName: string;
  blob: Blob;
  preview: string;
  takenAt: string;
  autoStore: boolean;
  state: 'waiting' | 'uploading' | 'sent' | 'error';
  error?: string;
  offline?: boolean;
}

const IDX_KEY = 'fruit.shootIndex';
const AUTO_NEXT_KEY = 'fruit.shootAutoNext';
const SIGN_KEY = 'fruit.shootSign';
const readFlag = (k: string, d: boolean) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v === '1';
  } catch {
    return d;
  }
};
const writeFlag = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? '1' : '0');
  } catch {
    /* 저장 불가 */
  }
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className={`min-h-10 flex-1 rounded-lg border px-2 font-bold ${on ? 'border-amber bg-amber text-carbon' : 'border-white/30 text-white/70'}`}>
      {label} {on ? '켬' : '끔'}
    </button>
  );
}
const readIdx = () => {
  try {
    return Number(localStorage.getItem(IDX_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};

export function ShootPage() {
  const [key, setKey] = useState(operatorKey.get());
  const [verified, setVerified] = useState(false);
  const verify = useMutation({
    mutationFn: (k: string) => adminApi.verify(k),
    onSuccess: (_d, k) => {
      operatorKey.set(k);
      setVerified(true);
    },
  });
  useEffect(() => {
    if (key && !verified) verify.mutate(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!verified) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-extrabold">촬영 모드</h1>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate(key.trim());
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-sm font-semibold">촬영 키</span>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" className="mt-1 min-h-12 w-full rounded-xl border border-chrome px-4" />
          </label>
          {verify.isError && <p role="alert" className="text-sm text-red-700">{verify.error.message}</p>}
          <button disabled={!key.trim() || verify.isPending} className="min-h-12 w-full btn-signal disabled:opacity-50">
            {verify.isPending ? '확인 중…' : '시작하기'}
          </button>
        </form>
        <Link href="/" className="text-center text-sm text-chrome underline">시세 보기로 돌아가기</Link>
      </div>
    );
  }
  return <Shooter />;
}

function Shooter() {
  const qc = useQueryClient();
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores });
  const list = useMemo(() => stores.data ?? [], [stores.data]);
  const [idx, setIdx] = useState(readIdx);
  const [auto, setAuto] = useState(() => readFlag(AUTO_NEXT_KEY, true));
  const [sign, setSign] = useState(() => readFlag(SIGN_KEY, true));
  useEffect(() => {
    writeFlag(AUTO_NEXT_KEY, auto);
  }, [auto]);
  useEffect(() => {
    writeFlag(SIGN_KEY, sign);
  }, [sign]);
  const [panel, setPanel] = useState<'none' | 'stores' | 'results'>('none');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [flash, setFlash] = useState(false);
  const current: Store | undefined = list.length ? list[((idx % list.length) + list.length) % list.length] : undefined;

  const go = useCallback(
    (next: number) => {
      const n = list.length ? ((next % list.length) + list.length) % list.length : 0;
      setIdx(n);
      try {
        localStorage.setItem(IDX_KEY, String(n));
      } catch {
        /* 저장 불가 */
      }
    },
    [list.length],
  );

  // ---- 카메라 ----
  const video = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setCamError('카메라 권한 필요'));
    if (!navigator.mediaDevices) setCamError('카메라 미지원');
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const enqueue = useCallback(
    (blob: Blob, takenAt: string, autoStore = false) => {
      if (!current) return;
      const item = { id: crypto.randomUUID(), storeId: current.id, storeName: autoStore ? `${current.name} · 간판 확인` : current.name, blob, takenAt, autoStore };
      void outbox.put(item);
      setJobs((js) => [{ ...item, preview: URL.createObjectURL(blob), state: 'waiting' }, ...js]);
    },
    [current],
  );

  // 지난번에 다 못 올린 사진을 이어서 올린다.
  useEffect(() => {
    void outbox.all().then((items) => {
      if (!items.length) return;
      setJobs((js) => {
        const known = new Set(js.map((j) => j.id));
        const restored = items
          .filter((i) => !known.has(i.id))
          .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
          .map((i): Job => ({ ...i, preview: URL.createObjectURL(i.blob), state: 'waiting' }));
        return [...js, ...restored];
      });
    });
  }, []);

  // 연결이 돌아오면 네트워크 오류로 실패한 업로드를 다시 시도한다.
  useEffect(() => {
    const retry = () => setJobs((js) => js.map((j) => (j.state === 'error' && j.offline ? { ...j, state: 'waiting' } : j)));
    window.addEventListener('online', retry);
    const timer = setInterval(retry, 20_000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, []);

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth || !current) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    navigator.vibrate?.(30);
    enqueue(await toJpeg(v, v.videoWidth, v.videoHeight), new Date().toISOString(), sign);
    track('shoot_capture', { store_id: current.id, source: 'camera' });
    if (auto) go(idx + 1);
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
      if (!bmp) continue;
      // 앨범에서 고른 사진은 간판으로 가게를 정한다.
      enqueue(await toJpeg(bmp, bmp.width, bmp.height), new Date(f.lastModified || Date.now()).toISOString(), true);
      track('shoot_capture', { store_id: current?.id ?? null, source: 'album' });
    }
  };

  // ---- 업로드 큐 (한 번에 하나씩, 실패하면 다시 시도) ----
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current) return;
    const job = [...jobs].reverse().find((j) => j.state === 'waiting');
    if (!job) return;
    busy.current = true;
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, state: 'uploading' } : j)));
    adminApi
      .upload(job.blob, job.storeId, job.takenAt, job.autoStore)
      .then(() => {
        track('upload_done', { store_id: job.storeId });
        void outbox.remove(job.id);
        setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, state: 'sent' } : j)));
        void qc.invalidateQueries({ queryKey: ['admin-photos'] });
      })
      .catch((e: ApiError) => {
        track('upload_failed', { store_id: job.storeId });
        // 상태 0은 연결 실패: 자동으로 다시 시도한다. 그 밖의 오류는 운영자가 확인한다.
        setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, state: 'error', error: e.message, offline: e.status === 0 } : j)));
      })
      .finally(() => {
        busy.current = false;
        setJobs((js) => [...js]);
      });
  }, [jobs, qc]);

  const pending = jobs.filter((j) => j.state === 'waiting' || j.state === 'uploading').length;
  const failed = jobs.filter((j) => j.state === 'error').length;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const photos = useQuery({ queryKey: ['admin-photos'], queryFn: adminApi.photos, refetchInterval: 4000 });
  const analyzing = photos.data?.filter((p) => p.status === 'queued' || p.status === 'analyzing').length ?? 0;
  const reviewing = photos.data?.reduce((n, p) => n + p.reviewCount, 0) ?? 0;

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      {/* 상단: 현재 가게 */}
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <button onClick={() => go(idx - 1)} aria-label="이전 가게" className="size-12 rounded-full bg-white/10 text-xl">‹</button>
        <button onClick={() => setPanel('stores')} className="min-h-12 flex-1 rounded-xl bg-white/10 px-3 text-center">
          {current ? (
            <>
              <span className="block text-[11px] text-white/60">
                {list.indexOf(current) + 1}/{list.length} · {placeName(current)}
              </span>
              <span className="block truncate text-lg font-bold">{current.name}</span>
            </>
          ) : (
            <span className="font-semibold">가게를 먼저 등록하세요</span>
          )}
        </button>
        <button onClick={() => go(idx + 1)} aria-label="다음 가게" className="size-12 rounded-full bg-white/10 text-xl">›</button>
      </div>

      {/* 뷰파인더 */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} autoPlay playsInline muted className="absolute inset-0 size-full object-cover" />
        {flash && <div className="absolute inset-0 bg-white/80" />}
        {camError && <p className="absolute inset-x-4 top-4 rounded-xl bg-black/70 p-3 text-sm">{camError}</p>}
        {jobs[0] && (
          <img src={jobs[0].preview} alt="방금 찍은 사진" className="absolute bottom-3 left-3 size-16 rounded-lg border-2 border-white object-cover" />
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="space-y-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span aria-live="polite">
            업로드 대기 {pending} · 분석 중 {analyzing}
            {failed > 0 && <span className="text-red-300"> · 실패 {failed}</span>}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <Toggle on={sign} onChange={setSign} label="간판 인식" />
          <Toggle on={auto} onChange={setAuto} label="찍으면 다음 가게" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex min-h-12 w-20 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-sm">
            사진 선택
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void pickFiles(e.target.files).finally(() => (e.target.value = ''))} />
          </label>
          <button
            onClick={() => void shoot()}
            disabled={!current || !!camError}
            aria-label={`${current?.name ?? ''} 촬영`}
            className="size-20 rounded-full border-4 border-white bg-white/90 shadow-lg active:scale-95 disabled:opacity-40"
          />
          <button onClick={() => setPanel('results')} className="relative min-h-12 w-20 rounded-xl bg-white/10 text-sm" aria-label={reviewing ? `결과, 확인 대기 ${reviewing}건` : '결과'}>
            결과
            {reviewing > 0 && <span className="chip-amber absolute -top-2 -right-2 min-w-6 rounded-full px-1.5 text-xs">{reviewing}</span>}
          </button>
        </div>
      </div>

      {panel === 'stores' && <StoresPanel stores={list} currentId={current?.id} onPick={(i) => (go(i), setPanel('none'))} onClose={() => setPanel('none')} />}
      {panel === 'results' && <ResultsPanel stores={list} photos={photos.data ?? []} jobs={jobs} retry={(id) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, state: 'waiting' } : j)))} discard={(id) => (void outbox.remove(id), setJobs((js) => js.filter((j) => j.id !== id)))} onClose={() => setPanel('none')} />}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-canvas text-carbon" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between border-b border-chrome px-4 py-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="min-h-11 rounded-lg px-3 font-semibold text-carbon">닫기</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function StoresPanel({ stores, currentId, onPick, onClose }: { stores: Store[]; currentId?: number; onPick: (index: number) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const term = q.replace(/\s/g, '');
  const shown = stores.map((s, i) => ({ s, i })).filter(({ s }) => !term || `${s.name}${s.address ?? ''}`.replace(/\s/g, '').includes(term));
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: '', aisle: 'main' as Aisle, position: 0, side: 'A' as Side });
  useEffect(() => {
    if (editing) setForm({ name: editing.name, aisle: editing.aisle, position: editing.position, side: editing.side });
  }, [editing]);
  const save = useMutation({
    mutationFn: () => (editing ? adminApi.updateStore(editing.id, form) : adminApi.createStore(form)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stores'] });
      setEditing(null);
      setForm((f) => ({ ...f, name: '' }));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteStore(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stores'] }),
  });

  return (
    <Sheet title="가게 선택·관리" onClose={onClose}>
      <label className="sticky -top-4 z-10 -mx-4 mb-3 block bg-canvas px-4 py-2">
        <span className="sr-only">가게 검색</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="가게 이름·주소" className="field min-h-11 w-full px-3" />
      </label>
      <ul className="space-y-2">
        {shown.map(({ s, i }) => (
          <li key={s.id} ref={s.id === currentId ? currentRef : undefined} className={`flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ${s.id === currentId ? 'ring-2 ring-signal' : 'ring-chrome'}`}>
            <button onClick={() => onPick(i)} className="min-h-11 flex-1 text-left">
              <span className="block font-semibold">
                <span className="mr-1 text-xs text-chrome num">{i + 1}</span>
                {s.name}
              </span>
              <span className="text-xs text-chrome">
                {placeName(s)} · {s.lastPhotoAt ? `${timeAgo(s.lastPhotoAt)} 촬영` : '촬영 기록 없음'}
              </span>
            </button>
            <button onClick={() => setEditing(s)} className="min-h-11 rounded-lg px-3 text-sm text-chrome">수정</button>
            <button onClick={() => confirm(`${s.name}을(를) 목록에서 뺄까요?`) && remove.mutate(s.id)} className="min-h-11 rounded-lg px-3 text-sm text-red-600">삭제</button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mt-6 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-chrome"
      >
        <h3 className="font-bold">{editing ? `${editing.name} 수정` : '가게 추가'}</h3>
        <label className="block text-sm">
          가게 이름 (간판)
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1 min-h-11 w-full rounded-lg border border-chrome px-3" />
        </label>
        <fieldset className="text-sm">
          <legend>통로</legend>
          <div className="mt-1 flex gap-1">
            {AISLES.map((a) => (
              <button type="button" key={a.id} onClick={() => setForm({ ...form, aisle: a.id })} aria-pressed={form.aisle === a.id} className={`min-h-11 flex-1 rounded-[2px] border text-xs ${form.aisle === a.id ? 'border-chrome bg-amber font-bold text-carbon' : 'border-chrome'}`}>
                {a.name}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            {form.aisle === 'main' ? '제기동역 끝에서 (m)' : '본통로부터 순번'}
            <input type="number" min={0} value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-chrome px-3" />
          </label>
          <fieldset className="flex-1 text-sm">
            <legend>위치</legend>
            <div className="mt-1 flex gap-1">
              {(['A', 'B'] as const).map((side) => (
                <button type="button" key={side} onClick={() => setForm({ ...form, side })} aria-pressed={form.side === side} className={`min-h-11 flex-1 rounded-lg border ${form.side === side ? 'border-chrome bg-amber font-bold text-carbon' : 'border-chrome'}`}>
                  {sideName(form.aisle, side)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
        <div className="flex gap-2">
          {editing && (
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 flex-1 rounded-lg bg-platinum font-semibold">취소</button>
          )}
          <button disabled={save.isPending} className="min-h-11 flex-1 btn-signal disabled:opacity-50">{editing ? '저장' : '추가'}</button>
        </div>
      </form>
    </Sheet>
  );
}

const statusLabel: Record<Photo['status'], string> = { queued: '대기', analyzing: '분석 중', done: '게시됨', failed: '실패' };

function ResultsPanel({ stores, photos, jobs, retry, discard, onClose }: { stores: Store[]; photos: Photo[]; jobs: Job[]; retry: (id: string) => void; discard: (id: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const failedJobs = jobs.filter((j) => j.state === 'error');
  return (
    <Sheet title="분석 결과" onClose={onClose}>
      {failedJobs.length > 0 && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-semibold">업로드 실패 {failedJobs.length}장</p>
          {failedJobs.map((j) => (
            <div key={j.id} className="mt-2 flex items-center gap-2">
              <img src={j.preview} alt="" className="size-10 rounded object-cover" />
              <span className="flex-1 truncate">{j.storeName} · {j.error}</span>
              <button onClick={() => retry(j.id)} className="min-h-10 rounded-lg bg-white px-3 font-semibold">다시</button>
              <button onClick={() => discard(j.id)} className="min-h-10 rounded-lg px-2 text-xs">버리기</button>
            </div>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {photos.map((p) => (
          <li key={p.id} className="rounded-xl bg-white ring-1 ring-chrome">
            <button onClick={() => setOpen(open === p.id ? null : p.id)} className="flex min-h-14 w-full items-center gap-3 p-2 text-left" aria-expanded={open === p.id}>
              {p.status === 'done' ? <img src={p.url} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-platinum" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.storeName}</span>
                <span className="block text-xs text-chrome">
                  {timeAgo(p.takenAt)} · {statusLabel[p.status]}
                  {p.status === 'done' && ` · 시세 ${p.itemCount}개`}
                  {p.reviewCount > 0 && <span className="font-bold text-[#c25f00]"> · 확인 대기 {p.reviewCount}</span>}
                  {p.durationMs && ` · ${Math.round(p.durationMs / 1000)}초`}
                </span>
                {p.readStoreName && p.readStoreName.replace(/\s/g, '') !== p.storeName.replace(/\s/g, '') && (
                  <span className="block text-xs text-[#c25f00]">간판: {p.readStoreName}</span>
                )}
                {p.error && <span className="block truncate text-xs text-red-600">{p.error}</span>}
              </span>
            </button>
            {open === p.id && <PhotoReview id={p.id} stores={stores} storeId={p.storeId} />}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function PhotoReview({ id, stores, storeId }: { id: string; stores: Store[]; storeId: number }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-photo', id], queryFn: () => adminApi.photo(id) });
  const patch = useMutation({
    mutationFn: ({ obsId, ...body }: { obsId: number; hidden?: boolean; review?: boolean; itemSlug?: string }) => adminApi.patchObservation(obsId, body),
    onSuccess: () => void qc.invalidateQueries(),
  });
  const reanalyze = useMutation({ mutationFn: () => adminApi.reanalyze(id), onSuccess: () => void qc.invalidateQueries() });
  const move = useMutation({ mutationFn: (sid: number) => adminApi.moveStore(id, sid), onSuccess: () => void qc.invalidateQueries() });
  if (!q.data) return <p className="p-3 text-sm text-chrome">불러오는 중…</p>;
  return (
    <div className="border-t border-platinum p-3">
      <label className="mb-3 block text-xs font-bold">
        가게
        <select value={storeId} onChange={(e) => move.mutate(Number(e.target.value))} className="field mt-1 block min-h-11 w-full px-2 text-sm">
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.address ?? placeName(s)}
            </option>
          ))}
        </select>
      </label>
      <ul className="space-y-2">
        {q.data.observations.map((o) => (
          <li key={o.id} className={`flex flex-wrap items-center gap-2 ${o.review ? 'rounded-lg bg-amber/30 p-1.5' : ''}`}>
            {o.cropUrl ? <img src={o.cropUrl} alt="" className="size-14 rounded object-cover" /> : <span className="size-14 rounded bg-platinum" />}
            <span className="min-w-0 flex-1 text-sm">
              {o.review && <span className="chip-amber mr-1 px-1 text-[11px]">확인 대기</span>}
              <label className="sr-only" htmlFor={`fruit-${o.id}`}>과일</label>
              <select
                id={`fruit-${o.id}`}
                value={o.itemSlug}
                onChange={(e) => patch.mutate({ obsId: o.id, itemSlug: e.target.value })}
                className="field mr-1 min-h-9 px-1 font-bold"
              >
                {CATALOG.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              {o.variety ?? ''} · {won(o.price)}
              {o.unit && `/${o.unit}`}
              <span className="block text-xs text-chrome">읽은 글자: {o.rawName} · 신뢰도 {Math.round(o.confidence * 100)}%</span>
            </span>
            {o.review && (
              <button onClick={() => patch.mutate({ obsId: o.id, hidden: false, review: false })} className="btn-signal min-h-10 px-3 text-xs">게시</button>
            )}
            <button onClick={() => patch.mutate({ obsId: o.id, hidden: true, review: false })} className="min-h-10 rounded-lg px-2 text-xs text-red-600 ring-1 ring-red-200">숨기기</button>
          </li>
        ))}
      </ul>
      <button onClick={() => reanalyze.mutate()} disabled={reanalyze.isPending} className="mt-3 min-h-11 w-full rounded-lg bg-platinum text-sm font-semibold">
        다시 분석
      </button>
    </div>
  );
}
