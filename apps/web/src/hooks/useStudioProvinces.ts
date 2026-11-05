import { useQuery } from '@tanstack/react-query';
import { geographyQueries } from '../lib/geography-queries';

export function useStudioProvinces() {
  return useQuery(geographyQueries.provinces(true));
}
