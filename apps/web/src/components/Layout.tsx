import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link } from './Link.tsx';
import { useLiveUpdates } from '../lib/live.ts';

const tabs = [
  { href: '/', label: '과일 시세', match: (p: string) => p === '/' || p.startsWith('/item') || p.startsWith('/photo') },
  { href: '/map', label: '시장 지도', match: (p: string) => p.startsWith('/map') || p.startsWith('/store') },
];

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const connected = useLiveUpdates();
  const header = useRef<HTMLElement>(null);
  // 고정 헤더 높이를 --header-h로 알려 지도 미니맵·스크롤 기준에 쓴다.
  useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-10">
      <header ref={header} className="sticky top-0 z-20 shadow-[0_2px_0_var(--color-chrome)]">
        <div className="carbon flex items-center justify-between gap-2 px-3 py-2">
          <Link href="/" className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]">
            <img src="/icon.svg" alt="" className="size-6" />
            <span className="font-display text-[15px] font-black tracking-tight text-primary">청량리 과일 시세</span>
          </Link>
          <span className="chip-amber flex items-center gap-1.5 px-2 py-1 text-[11px]" aria-live="polite">
            <span className={`size-2 rounded-full ${connected ? 'animate-pulse bg-green-600' : 'bg-muted-indigo'}`} />
            {connected ? 'LIVE' : '연결 중'}
          </span>
        </div>
        <nav className="carbon flex border-t border-black/60" aria-label="주 메뉴">
          {tabs.map((t) => {
            const active = t.match(path);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`min-h-11 flex-1 px-3 py-3 text-center text-[13px] font-bold tracking-[0.5px] ${active ? 'bg-chrome text-white shadow-[inset_0_3px_0_var(--color-signal)]' : 'text-nav-gold'}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="px-3 pt-4">{children}</main>
      <footer className="carbon mt-10 px-4 py-3 text-center text-[11px] text-sky">청량리 청과물시장</footer>
    </div>
  );
}
