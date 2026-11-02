import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  authService,
  type LoginInput,
  type RegisterInput,
} from '../services/authService';

export const authQueryKey = ['auth', 'me'] as const;

export function useAuth() {
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: ({ signal }) => authService.currentUser(signal),
    retry: false,
    staleTime: Infinity,
  });
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (user) => queryClient.setQueryData(authQueryKey, user),
  });
  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
  });
  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => queryClient.setQueryData(authQueryKey, null),
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
