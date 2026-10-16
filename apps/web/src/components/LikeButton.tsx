import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { track } from '../lib/analytics.ts';

export function LikeButton({ photoId, likes, liked }: { photoId: string; likes: number; liked: boolean }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ likes, liked });
  const [busy, setBusy] = useState(false);
  useEffect(() => setState({ likes, liked }), [likes, liked]);

  const toggle = async () => {
    if (busy) return;
    const next = !state.liked;
    const before = state;
    setState({ liked: next, likes: Math.max(0, state.likes + (next ? 1 : -1)) });
    setBusy(true);
    try {
      setState(await api.like(photoId, next));
      if (next) track('like', { photo_id: photoId });
      void qc.invalidateQueries({ queryKey: ['feed', 'popular'] });
    } catch {
      setState(before);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={toggle} aria-pressed={state.liked} aria-label={state.liked ? '좋아요 취소' : '좋아요'} className="flex min-h-11 items-center gap-1.5 px-1 font-bold">
      <svg viewBox="0 0 24 24" className={`size-7 transition-transform ${state.liked ? 'scale-110' : ''}`} aria-hidden>
        <path
          d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z"
          fill={state.liked ? 'var(--color-primary)' : 'white'}
          stroke="var(--color-carbon)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span className="num text-sm">{state.likes}</span>
    </button>
  );
}
