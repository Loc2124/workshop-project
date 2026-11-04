import { useEffect, useState } from 'react';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';
import { catalogService } from '../services/catalogService';
export function useProvinces() {
  const [provinces, setProvinces] = useState<ProvinceOption[]>(() => []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    catalogService
      .provinces(controller.signal)
      .then(({ provinces }) => {
        if (!controller.signal.aborted) {
          setProvinces(
            provinces.filter((province) => province.studioCount > 0),
          );
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Chưa tải được danh sách tỉnh/thành.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return { provinces, error, loading };
}
