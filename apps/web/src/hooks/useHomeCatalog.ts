import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicFeatured } from '../services/featuredService';
import { provinceSlug } from '../lib/catalog';
import { detectProvinceId } from '../services/locationService';
import { useProvinces } from './useProvinces';
import { homeSearchFormSchema } from '../lib/form-validation';

const preferenceKey = 'open-slot.province';
const attemptKey = 'open-slot.location-attempted';

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
  const [searchError, setSearchError] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const locationController = useRef<AbortController | null>(null);
  const [params] = useSearchParams();
  const preview = params.get('featuredPreview') ?? undefined;
  const featured = useQuery({
    queryKey: ['catalog', 'home-featured', preview ?? 'public'],
    queryFn: ({ signal }) => getPublicFeatured(signal, preview),
    staleTime: 30000,
  });
  const provinceName = provinces.find(
    (province) => province.id === provinceId,
  )?.name;
  const featuredWorkshops = featured.data?.workshops ?? [];
  const featuredStudios = featured.data?.studios ?? [];

  const requestLocation = useCallback(() => {
    locationController.current?.abort();
    const controller = new AbortController();
    locationController.current = controller;
    window.localStorage.setItem(attemptKey, 'true');
    setLocationStatus('Đang tìm studio gần bạn…');
    detectProvinceId(provinces, controller.signal)
      .then((id) => {
        if (controller.signal.aborted) return;
        if (id) {
          setProvinceId(id);
          window.localStorage.setItem(preferenceKey, id);
        }
        setLocationStatus(
          id ? '' : 'Bạn có thể chọn tỉnh, thành phố để tìm studio.',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLocationStatus('Bạn có thể chọn tỉnh, thành phố để tìm studio.');
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
    const parsed = homeSearchFormSchema
      .refine(
        (input) =>
          !input.provinceId ||
          provinces.some((province) => province.id === input.provinceId),
        { path: ['provinceId'], message: 'Chọn tỉnh, thành phố hợp lệ.' },
      )
      .safeParse({ query, date, provinceId });
    if (!parsed.success) {
      setSearchError(
        parsed.error.issues[0]?.message ?? 'Thông tin tìm kiếm chưa hợp lệ.',
      );
      return;
    }
    setSearchError('');
    const params = new URLSearchParams(browseParams);
    if (parsed.data.date) params.set('date', parsed.data.date);
    if (parsed.data.query) params.set('q', parsed.data.query);
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
    searchError,
    browseUrl,
    featuredWorkshops,
    featuredStudios,
    preview,
    previewError:
      preview && featured.error
        ? 'Bản xem trước không còn dùng được hoặc bạn chưa có quyền admin. Hãy mở lại từ trang quản trị.'
        : null,
    loading: featured.isPending,
    error: featured.isError,
    refetch: () => void featured.refetch(),
  };
}
