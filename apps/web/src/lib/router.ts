import { useSyncExternalStore } from 'react';

const subscribe = (fn: () => void) => {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
};

export function useLocation() {
  return useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search);
}

export function navigate(to: string, replace = false) {
  if (to === window.location.pathname + window.location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!replace) window.scrollTo(0, 0);
}

/** '/item/:slug' 형태 패턴 매칭 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const s = path.split('?')[0]!.split('/');
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(':')) params[p[i]!.slice(1)] = decodeURIComponent(s[i]!);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
