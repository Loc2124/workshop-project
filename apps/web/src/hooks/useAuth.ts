import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import {
  onSessionCacheChange,
  sessionCacheVersion,
} from '../lib/session-events';
import { authQueryKey, synchronizeSession } from '../lib/session-cache';
import {
  authService,
  type LoginInput,
  type RegisterInput,
} from '../services/authService';

export { authQueryKey } from '../lib/session-cache';

export function useAuth() {
  useSyncExternalStore(onSessionCacheChange, sessionCacheVersion, () => 0);
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: async ({ signal }) => {
      const user = await authService.currentUser(signal);
      if (!signal.aborted) await synchronizeSession(queryClient, user);
      return user;
    },
    retry: false,
    staleTime: Infinity,
  });
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (user) => synchronizeSession(queryClient, user),
  });
  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
  });
  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSettled: () => synchronizeSession(queryClient, null, true),
  });

  return {
    user: currentUserQuery.data ?? null,
    isLoading: currentUserQuery.isPending,
    authError: currentUserQuery.error,
    retryAuth: currentUserQuery.refetch,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
