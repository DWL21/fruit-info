import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from './api.ts';

/** SSE로 새 시세를 받으면 관련 쿼리를 다시 불러온다. */
export function useLiveUpdates() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/stream`);
    es.addEventListener('ready', () => setConnected(true));
    es.addEventListener('prices', () => {
      void qc.invalidateQueries();
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [qc]);
  return connected;
}
