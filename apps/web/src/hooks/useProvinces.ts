import { useEffect, useState } from 'react';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';
import { mockProvinceOptions } from '../lib/catalog';
import { catalogService } from '../services/catalogService';
import { isDemoDataMode } from '../lib/data-mode';

export function useProvinces() {
  const [provinces, setProvinces] = useState<ProvinceOption[]>(() =>
    isDemoDataMode ? mockProvinceOptions() : [],
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!isDemoDataMode);
  useEffect(() => {
    if (isDemoDataMode) return;
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
