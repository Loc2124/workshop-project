import { queryOptions } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';
import { queryKeys } from './query-keys';

export const geographyQueries = {
  provinces: (includeEmpty = false) =>
    queryOptions({
      queryKey: [
        ...queryKeys.public.provinces,
        includeEmpty ? 'all' : 'available',
      ],
      queryFn: ({ signal }) => catalogService.provinces(signal, includeEmpty),
      staleTime: 60_000,
    }),
  areas: (provinceId: string) =>
    queryOptions({
      queryKey: [...queryKeys.public.areas, provinceId],
      queryFn: ({ signal }) => catalogService.areas(provinceId, signal),
      staleTime: 60_000,
    }),
};
