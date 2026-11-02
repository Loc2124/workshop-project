import { useQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';

export function useStudioProvinces() {
  return useQuery({
    queryKey: ['catalog', 'provinces', 'all'],
    queryFn: ({ signal }) => catalogService.provinces(signal, true),
    staleTime: 60_000,
  });
}
