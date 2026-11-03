export type SessionEvent = (
  { type: 'expired' } | { type: 'refreshed'; user: unknown }
) & { epoch?: number };
type Listener = (event: SessionEvent) => Promise<void>;
const listeners = new Set<Listener>();
let epoch = 0;
export const sessionEpoch = () => epoch;
export function advanceSessionEpoch() {
  epoch++;
}
let cacheVersion = 0;
const cacheListeners = new Set<() => void>();
export const sessionCacheVersion = () => cacheVersion;
export function onSessionCacheChange(listener: () => void) {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}
export function notifySessionCacheChange() {
  cacheVersion++;
  cacheListeners.forEach((listener) => listener());
}
export function onSessionEvent(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function emitSessionEvent(event: SessionEvent) {
  await Promise.all([...listeners].map((listener) => listener(event)));
}
