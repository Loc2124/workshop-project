import { useEffect, useState } from 'react';
import type { WorkshopSession } from '../types/workshop';
import { nextSessionBoundary } from '../lib/sessionStatus';

export function useSessionClock(sessions: WorkshopSession[]) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const boundary = nextSessionBoundary(sessions, now);
    const timer =
      boundary === undefined
        ? undefined
        : window.setTimeout(
            refresh,
            Math.min(2_147_483_647, Math.max(1, boundary - now + 1)),
          );
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [sessions, now]);
  return now;
}
