import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { mockWorkshops } from '../data/mockWorkshops';
import { provinceSlug } from '../lib/catalog';
import { rankWorkshops } from '../lib/rankWorkshops';
import { detectProvinceId } from '../services/locationService';
import { useCatalog } from './useCatalog';
import { useProvinces } from './useProvinces';

const preferenceKey = 'open-slot.province';
const attemptKey = 'open-slot.location-attempted';
const pageSize = 5;

export function useHomeCatalog() {
  const navigate = useNavigate();
  const {
    provinces,
    error: provinceError,
    loading: provincesLoading,
  } = useProvinces();
  const [provinceId, setProvinceId] = useState<string | undefined>(
    () => window.localStorage.getItem(preferenceKey) ?? undefined,
  );
  const [date, setDate] = useState('');
  const [query, setQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const locationController = useRef<AbortController | null>(null);
  const catalog = useCatalog(
    { provinceId, page: 1, pageSize: 100 },
    !import.meta.env.DEV,
  );
  const provinceName = provinces.find(
    (province) => province.id === provinceId,
  )?.name;
  const featuredWorkshops = useMemo(() => {
    const source = import.meta.env.DEV
      ? mockWorkshops.filter(
          (workshop) => !provinceId || workshop.provinceId === provinceId,
        )
      : (catalog.data?.items ?? []);
    return rankWorkshops(source).slice(0, pageSize);
  }, [catalog.data?.items, provinceId]);

  const requestLocation = useCallback(() => {
    locationController.current?.abort();
    const controller = new AbortController();
    locationController.current = controller;
    window.localStorage.setItem(attemptKey, 'true');
    setLocationStatus('Đang tìm xưởng gần bạn…');
    detectProvinceId(provinces, controller.signal)
      .then((id) => {
        if (controller.signal.aborted) return;
        if (id) {
          setProvinceId(id);
          window.localStorage.setItem(preferenceKey, id);
        }
        setLocationStatus(
          id ? '' : 'Bạn có thể chọn tỉnh, thành phố để tìm xưởng.',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLocationStatus('Bạn có thể chọn tỉnh, thành phố để tìm xưởng.');
      });
    return controller;
  }, [provinces]);

  useEffect(() => {
    if (
      !provinces.length ||
      provinceId ||
      window.localStorage.getItem(attemptKey)
    )
      return;
    const controller = requestLocation();
    return () => {
      if (
        !controller.signal.aborted &&
        !window.localStorage.getItem(preferenceKey)
      )
        window.localStorage.removeItem(attemptKey);
      controller.abort();
    };
  }, [provinces, provinceId, requestLocation]);
  useEffect(() => () => locationController.current?.abort(), []);

  function changeProvince(id?: string) {
    locationController.current?.abort();
    window.localStorage.setItem(attemptKey, 'true');
    setLocationStatus('');
    setProvinceId(id);
    if (id) window.localStorage.setItem(preferenceKey, id);
    else window.localStorage.removeItem(preferenceKey);
  }
  const browseParams = new URLSearchParams({ view: 'workshop' });
  if (provinceId)
    browseParams.set(
      'province',
      provinceName ? provinceSlug(provinceName) : provinceId,
    );
  const browseUrl = `/kham-pha?${browseParams}`;
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(browseParams);
    if (date) params.set('date', date);
    if (query.trim()) params.set('q', query.trim());
    navigate(`/kham-pha?${params}`);
  }
  return {
    provinceId,
    provinceName,
    provinces,
    provinceError,
    provincesLoading,
    locationStatus,
    date,
    setDate,
    query,
    setQuery,
    changeProvince,
    retryLocation: () => {
      if (provinces.length) requestLocation();
    },
    submitSearch,
    browseUrl,
    featuredWorkshops,
    loading: !import.meta.env.DEV && catalog.isLoading,
    error: !import.meta.env.DEV && catalog.isError,
    refetch: () => void catalog.refetch(),
  };
}
