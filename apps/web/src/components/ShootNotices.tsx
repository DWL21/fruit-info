import { useEffect } from 'react';
import type { Photo } from '@fruit/shared';

export interface Notice {
  photo: Photo;
  /** 비어 있으면 정상 완료 */
  problems: string[];
}

const norm = (s: string | null) => (s ?? '').replace(/\s/g, '');

/** 분석이 끝난 사진에서 운영자가 확인해야 할 문제를 찾는다. */
export function problemsOf(photo: Photo, autoStore: boolean): string[] {
  if (photo.status === 'failed') return [`분석 실패${photo.error ? ` · ${photo.error}` : ''}`];
  const out: string[] = [];
  if (autoStore && !photo.readStoreName) out.push(`간판 인식 실패 · ${photo.storeName}로 배정`);
  if (photo.readStoreName && norm(photo.readStoreName) !== norm(photo.storeName)) out.push(`간판 '${photo.readStoreName}' ≠ ${photo.storeName}`);
  if (photo.itemCount === 0 && photo.reviewCount === 0) out.push('읽은 시세 없음');
  if (photo.reviewCount > 0) out.push(`확인 대기 ${photo.reviewCount}건`);
  return out;
}

/** 정상 완료: 잠깐 떴다 사라지는 팝업 */
export function DoneToast({ notice, onOpen, onDismiss }: { notice: Notice; onOpen: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const p = notice.photo;
  return (
    <button onClick={onOpen} role="status" className="plate-white flex w-full items-center gap-2 p-2 text-left text-carbon shadow-lg">
      <img src={p.url} alt="" className="size-12 shrink-0 rounded-[2px] object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{p.storeName}</span>
        <span className="block text-xs font-bold text-chrome">
          시세 {p.itemCount}개 게시{p.durationMs ? ` · ${Math.round(p.durationMs / 1000)}초` : ''}
        </span>
      </span>
      <span className="chip-amber shrink-0 px-1.5 py-0.5 text-xs">완료</span>
    </button>
  );
}

/** 문제가 있을 때: 닫아야 사라지는 경고창 */
export function ProblemAlert({ notice, onOpen, onClose }: { notice: Notice; onOpen: () => void; onClose: () => void }) {
  useEffect(() => {
    navigator.vibrate?.([80, 40, 80]);
  }, [notice.photo.id]);
  const p = notice.photo;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="alertdialog" aria-modal="true" aria-label={`${p.storeName} 확인 필요`}>
      <div className="plate-white w-full max-w-sm overflow-hidden text-carbon">
        <div className="flex items-center gap-2 border-b border-chrome bg-amber px-3 py-2 font-bold">확인 필요</div>
        <div className="flex gap-3 p-3">
          {p.status === 'done' ? <img src={p.url} alt="" className="size-16 shrink-0 rounded-[2px] object-cover" /> : <span className="size-16 shrink-0 rounded-[2px] bg-platinum" />}
          <div className="min-w-0">
            <p className="truncate font-bold">{p.storeName}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {notice.problems.map((m) => (
                <li key={m} className="font-bold text-[#c25f00]">· {m}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex gap-2 p-3 pt-0">
          <button onClick={onClose} className="min-h-11 flex-1 rounded-[2px] bg-platinum font-bold">닫기</button>
          <button onClick={onOpen} className="btn-signal min-h-11 flex-1">고치기</button>
        </div>
      </div>
    </div>
  );
}
