import type { QueryClient, Query } from '@tanstack/react-query';
import type { AuthUser } from '@/services/authService';
import {
  advanceSessionEpoch,
  onSessionEvent,
  sessionEpoch,
  notifySessionCacheChange,
} from '../domain/session-events';
import { studioDraftKey } from '../domain/studio-registration-draft';
import { activeStudioKey } from '../domain/studio-dashboard';
import { clearUserBookingRequests } from '../domain/booking-request';

export const authQueryKey = ['auth', 'me'] as const;
type State = { id: string | null | undefined; pending: Promise<void> };
const states = new WeakMap<QueryClient, State>();
// Only these namespaces contain responses independent of the current account.
// Unknown keys are removed conservatively; admin previews use private/userId.
const accountQuery = (query: Query) =>
  !['catalog', 'categories', 'site-settings'].includes(
    String(query.queryKey[0]),
  );
function stateFor(client: QueryClient) {
  let state = states.get(client);
  if (!state) {
    state = {
      id: client.getQueryData<AuthUser | null>(authQueryKey)?.id,
      pending: Promise.resolve(),
    };
    states.set(client, state);
  }
  return state;
}
function removeDraft(userId: string | null | undefined) {
  if (!userId) return;
  try {
    sessionStorage.removeItem(studioDraftKey(userId));
    sessionStorage.removeItem(activeStudioKey(userId));
  } catch {
    /* Storage can be disabled. */
  }
  clearUserBookingRequests(userId);
}
export function synchronizeSession(
  client: QueryClient,
  user: AuthUser | null,
  force = false,
  expectedEpoch?: number,
): Promise<void> {
  const state = stateFor(client);
  const transition = async () => {
    if (expectedEpoch !== undefined && expectedEpoch !== sessionEpoch()) return;
    const next = user?.id ?? null;
    const clearing = force || (state.id !== undefined && state.id !== next);
    if (clearing) {
      const previous = state.id;
      await client.cancelQueries({ predicate: accountQuery });
      client.removeQueries({ predicate: accountQuery });
      client.getMutationCache().clear();
      advanceSessionEpoch();
      removeDraft(previous);
    }
    state.id = next;
    client.setQueryData(authQueryKey, user);
    // Removing account Queries also removes the one observed by useAuth. Rebind
    // the new auth entry even when the old /me request itself was cancelled.
    if (clearing) notifySessionCacheChange();
  };
  state.pending = state.pending.then(transition, transition);
  return state.pending;
}
export function installSessionLifecycle(client: QueryClient) {
  const stopEvents = onSessionEvent(async (event) => {
    if (event.type === 'expired')
      await synchronizeSession(client, null, true, event.epoch);
    else {
      const { authUserSchema } = await import('@/services/authSchemas');
      const parsed = authUserSchema.safeParse(event.user);
      if (!parsed.success) throw new Error('Invalid refresh response');
      await synchronizeSession(client, parsed.data, false, event.epoch);
    }
  });
  // Mutations cannot be aborted by React Query; discard late writes by an old account.
  const stopCache = client.getQueryCache().subscribe((event) => {
    if (
      (event.type === 'added' || event.type === 'updated') &&
      event.query.queryKey[0] === 'private'
    ) {
      const current =
        client.getQueryData<AuthUser | null>(authQueryKey)?.id ?? 'anonymous';
      if (event.query.queryKey[1] !== current)
        client.getQueryCache().remove(event.query);
    }
  });
  return () => {
    stopEvents();
    stopCache();
  };
}
