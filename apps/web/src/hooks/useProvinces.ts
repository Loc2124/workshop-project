import { useQuery } from '@tanstack/react-query';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';
import { geographyQueries } from '../lib/geography-queries';

const emptyProvinces: ProvinceOption[] = [];
const availableProvinces = (data: { provinces: ProvinceOption[] }) =>
  data.provinces.filter((province) => province.studioCount > 0);

export function useProvinces(enabled = true) {
  const query = useQuery({
    ...geographyQueries.provinces(),
    enabled,
    select: availableProvinces,
  });
  return {
    provinces: query.data ?? emptyProvinces,
    error: query.error ? 'Chưa tải được danh sách tỉnh/thành.' : '',
    loading: enabled && query.isPending,
    queryError: query.error,
  };
}
