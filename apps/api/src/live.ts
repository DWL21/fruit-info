import type { LiveEvent } from '@fruit/shared';

type Listener = (event: LiveEvent) => void;
const listeners = new Set<Listener>();

export const live = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  publish(event: LiveEvent) {
    for (const fn of listeners) fn(event);
  },
  get size() {
    return listeners.size;
  },
};
