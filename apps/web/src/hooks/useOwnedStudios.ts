import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { queryKeys } from '../lib/query-keys';
export function useMyStudios() {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.studios.mine(user?.id),
    queryFn: async ({ signal }) =>
      (
        await import('../services/managementService')
      ).managementService.listMyStudios(signal),
    enabled: !isLoading && !!user,
  });
}
