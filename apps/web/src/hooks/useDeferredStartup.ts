import { useEffect, useState, useSyncExternalStore } from 'react';
const subscribe = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
};
const visible = () => document.visibilityState === 'visible';
export function useDeferredStartup(enabled = true) {
  const [ready, setReady] = useState(false);
  const foreground = useSyncExternalStore(subscribe, visible, () => true);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false,
      id: number | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (!cancelled) setReady(true);
    };
    const schedule = () => {
      if ('requestIdleCallback' in window)
        id = window.requestIdleCallback(done, { timeout: 2000 });
      else timer = setTimeout(done, 150);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (id !== undefined) window.cancelIdleCallback(id);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
  return enabled && ready && foreground;
}
