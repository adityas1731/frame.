import { useEffect, useRef, useState } from 'react';
import { useConnection, errorMessage } from './useConnection';
import { JellyfinError } from './client';
export function useRemote<T>(key: string, load: () => Promise<T>, playbackUpdates=true) {
  const { client } = useConnection();
  const loader = useRef(load); loader.current = load;
  const [revision, setRevision] = useState(0);
  useEffect(()=>{const reload=()=>setRevision(v=>v+1);window.addEventListener('frame:server-reload',reload);return()=>window.removeEventListener('frame:server-reload',reload);},[]);
  useEffect(()=>{if(!playbackUpdates)return;const updated=()=>setRevision(v=>v+1);window.addEventListener('frame:playback-updated',updated);return()=>window.removeEventListener('frame:playback-updated',updated);},[playbackUpdates]);
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  useEffect(() => {
    let ignore = false;
    setState(old => ({ key, data: old.key === key ? old.data : undefined, loading: old.key !== key || old.data === undefined }));
    loader.current().then(data => { if (!ignore) setState({ key, data, loading: false }); }, error => {
      const unavailable = error instanceof JellyfinError && [401, 403, 404].includes(error.status);
      if (!ignore) setState(old => ({ key, data: !unavailable && old.key === key ? old.data : undefined, error: errorMessage(error), loading: false }));
    });
    return () => { ignore = true; };
  }, [client, key, revision]);
  const visible = state.key === key ? state : { key, loading: true };
  return { data: visible.data, error: visible.error, loading: visible.loading, revalidate: () => setRevision(v=>v+1), retry: () => { client?.invalidate(); setRevision(v => v + 1); } };
}
export function useDebounced(value: string, delay = 350) {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return settled;
}

