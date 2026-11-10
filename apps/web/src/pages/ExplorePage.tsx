import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import type { AreaOption } from '../components/catalog/AreaMultiSelect';
import { ExploreFilters } from '../components/catalog/ExploreFilters';
import { Pagination } from '../components/catalog/Pagination';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';
import { ViewToggle, type CatalogView } from '../components/catalog/ViewToggle';
import { WorkshopGrid } from '../components/catalog/WorkshopGrid';
import { ActiveFilterChips } from '../components/catalog/ActiveFilterChips';
import { countActiveFilters } from '../components/catalog/MobileFilterSheet';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { categories, getCategoryMeta } from '../constants/categories';
import {
  catalogKeys,
  useCatalog,
  useCatalogStudios,
} from '../hooks/useCatalog';
import { useCategoriesQuery } from '../hooks/useCategories';
import { useProvinces } from '../hooks/useProvinces';
import { provinceSlug } from '../lib/catalog';
import { parseExploreUrl } from '../lib/explore-url';
import { catalogService } from '../services/catalogService';
import { detectProvinceId } from '../services/locationService';
import type { CatalogFilters, SortOption } from '../types/catalog';
const pageSize = 12;
const provincePreferenceKey = 'open-slot.province';
const locationAttemptKey = 'open-slot.location-attempted';
const defaultFilters: CatalogFilters = { page: 1, pageSize };
function replaceParamsIfChanged(
  next: URLSearchParams,
  current: URLSearchParams,
  replace: (params: URLSearchParams, options: { replace: true }) => void,
) {
  if (next.toString() !== current.toString()) replace(next, { replace: true });
}
function writeFilters(
  params: URLSearchParams,
  filters: CatalogFilters,
  provinces: ProvinceOption[],
) {
  const keys = [
    'mon',
    'type',
    'province',
    'date',
    'category',
    'category_id',
    'province_id',
    'area_ids',
    'level',
    'audience',
    'price_min',
    'price_max',
    'date_from',
    'date_to',
    'same_day',
    'page',
  ];
  keys.forEach((key) => params.delete(key));
  if (filters.categoryId)
    params.set('type', getCategoryMeta(filters.categoryId).slug);
  if (filters.provinceId) {
    const province = provinces.find((item) => item.id === filters.provinceId);
    params.set(
      'province',
      province ? provinceSlug(province.name) : filters.provinceId,
    );
  }
  filters.areaIds?.forEach((areaId) => params.append('area_ids', areaId));
  if (filters.level) params.set('level', filters.level);
  if (filters.audience) params.set('audience', filters.audience);
  if (filters.priceMin !== undefined)
    params.set('price_min', String(filters.priceMin));
  if (filters.priceMax !== undefined)
    params.set('price_max', String(filters.priceMax));
  if (filters.dateFrom && filters.dateFrom === filters.dateTo)
    params.set('date', filters.dateFrom);
  else {
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
  }
  if (filters.takeawaySameDay) params.set('same_day', 'true');
  if (filters.page > 1) params.set('page', String(filters.page));
}
export function ExplorePage() {
  const nextPageMarker = useRef<HTMLDivElement>(null);
  const defaultProvinceApplied = useRef(false);
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = useCategoriesQuery();
  const categoriesReady = categoryQuery.isSuccess;
  const { provinces: provinceOptions, error: provinceError } = useProvinces();
  const parsedUrl = useMemo(
    () => parseExploreUrl(searchParams, provinceOptions, categoriesReady),
    [searchParams, provinceOptions, categoriesReady, categories],
  );
  const { filters, sort, view, query: appliedQuery } = parsedUrl;
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const requestFilters = useMemo(
    () => ({
      ...filters,
      query: appliedQuery,
      sort,
      page: filters.page,
      pageSize,
    }),
    [filters, appliedQuery, sort],
  );
  const catalog = useCatalog(requestFilters, view === 'workshops');
  const studiosCatalog = useCatalogStudios(requestFilters, view === 'studios');
  const source = catalog.data?.items ?? [];
  const filteredWorkshops = useMemo(
    () => source,
    [source, filters, appliedQuery, false],
  );
  const sortedWorkshops = useMemo(() => {
    return filteredWorkshops;
  }, [filteredWorkshops, appliedQuery, sort, false]);
  const studioListings = useMemo(
    () => studiosCatalog.data?.items ?? [],
    [sortedWorkshops, false, studiosCatalog.data?.items],
  );
  const sortedStudios = useMemo(() => {
    return studioListings;
  }, [sort, studioListings, false]);
  const apiPagination =
    view === 'studios'
      ? studiosCatalog.data?.pagination
      : catalog.data?.pagination;
  const totalCount = apiPagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = filters.page;
  const visibleWorkshops = sortedWorkshops;
  const visibleStudios = sortedStudios;
  const selectedProvince = provinceOptions.find(
    (province) => province.id === filters.provinceId,
  );
  const updateFilters = useCallback(
    (next: CatalogFilters, switchToWorkshops = false) => {
      const params = new URLSearchParams(searchParams);
      writeFilters(params, { ...next, page: 1, pageSize }, provinceOptions);
      if (switchToWorkshops) params.set('view', 'workshop');
      replaceParamsIfChanged(params, searchParams, setSearchParams);
      if (next.provinceId) {
        window.localStorage.setItem(provincePreferenceKey, next.provinceId);
        setLocationError('');
      } else {
        window.localStorage.removeItem(provincePreferenceKey);
      }
    },
    [searchParams, setSearchParams, provinceOptions],
  );
  const updateSort = (next: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', next);
    params.delete('page');
    replaceParamsIfChanged(params, searchParams, setSearchParams);
  };
  const updateView = (next: CatalogView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next === 'studios' ? 'studio' : 'workshop');
    params.delete('page');
    replaceParamsIfChanged(params, searchParams, setSearchParams);
  };
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    writeFilters(params, defaultFilters, provinceOptions);
    params.delete('q');
    params.delete('page');
    window.localStorage.removeItem(provincePreferenceKey);
    replaceParamsIfChanged(params, searchParams, setSearchParams);
  };
  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    writeFilters(
      params,
      { ...filters, page: nextPage, pageSize },
      provinceOptions,
    );
    replaceParamsIfChanged(params, searchParams, setSearchParams);
  };
  const requestLocation = useCallback(
    async (showError = false) => {
      setIsLocating(true);
      if (showError) setLocationError('');
      try {
        const provinceId = await detectProvinceId(provinceOptions);
        if (!provinceId) {
          if (showError)
            setLocationError(
              'Không tìm thấy tỉnh/thành gần bạn; hãy chọn thủ công.',
            );
          return;
        }
        updateFilters({ ...filters, provinceId, areaIds: undefined });
      } catch {
        if (showError)
          setLocationError(
            'Không lấy được vị trí; bạn có thể chọn tỉnh/thành.',
          );
      } finally {
        setIsLocating(false);
      }
    },
    [filters, provinceOptions, updateFilters],
  );
  const searchString = searchParams.toString();
  const normalizedSearchString = parsedUrl.normalizedParams.toString();
  useEffect(() => {
    if (defaultProvinceApplied.current || provinceOptions.length === 0) return;
    defaultProvinceApplied.current = true;
    const currentParams = new URLSearchParams(searchString);
    if (!currentParams.has('province') && !currentParams.has('province_id')) {
      const savedProvince = window.localStorage.getItem(provincePreferenceKey);
      if (
        savedProvince &&
        provinceOptions.some((item) => item.id === savedProvince)
      ) {
        updateFilters({ ...filters, provinceId: savedProvince });
        return;
      }
      if (
        provinceOptions.length > 0 &&
        !window.localStorage.getItem(locationAttemptKey)
      ) {
        window.localStorage.setItem(locationAttemptKey, 'true');
        void requestLocation();
      }
    }
  }, [filters, provinceOptions, requestLocation, updateFilters, searchString]);
  useEffect(() => {
    // Wait for reference data before canonicalizing aliases; an explicit province
    // id must survive the initial render while provinces are still loading.
    if (provinceOptions.length === 0 || !categoriesReady) return;
    const params = new URLSearchParams(normalizedSearchString);
    const expectedView = view === 'studios' ? 'studio' : 'workshop';
    if (params.get('view') !== expectedView) params.set('view', expectedView);
    if (params.toString() !== searchString)
      setSearchParams(params, { replace: true });
  }, [
    categoriesReady,
    provinceOptions.length,
    normalizedSearchString,
    searchString,
    setSearchParams,
    view,
  ]);
  const titleLocation = selectedProvince?.name.replace(
    'TP. Hồ Chí Minh',
    'TP.HCM',
  );
  useEffect(() => {
    const selected = view === 'studios' ? studiosCatalog : catalog;
    if (
      !nextPageMarker.current ||
      selected.isPlaceholderData ||
      !selected.data ||
      requestFilters.page * requestFilters.pageSize >=
        selected.data.pagination.total
    )
      return;
    const connection = (
      navigator as Navigator & {
        connection?: {
          saveData?: boolean;
          effectiveType?: string;
        };
      }
    ).connection;
    if (connection?.saveData || connection?.effectiveType === 'slow-2g') return;
    const next = { ...requestFilters, page: requestFilters.page + 1 };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (view === 'studios')
          void client.prefetchQuery({
            queryKey: catalogKeys.studios(next),
            queryFn: ({ signal }) => catalogService.listStudios(next, signal),
            staleTime: 30000,
          });
        else
          void client.prefetchQuery({
            queryKey: catalogKeys.list(next),
            queryFn: ({ signal }) => catalogService.list(next, signal),
            staleTime: 30000,
          });
      },
      { rootMargin: '400px' },
    );
    observer.observe(nextPageMarker.current);
    return () => observer.disconnect();
  }, [
    client,
    view,
    requestFilters,
    false,
    catalog.data,
    studiosCatalog.data,
    catalog.isPlaceholderData,
    studiosCatalog.isPlaceholderData,
  ]);
  return (
    <>
      <PageContainer as="main" className="max-w-6xl pb-12">
        <PageBreadcrumb className="pt-3" items={[{ label: 'Khám phá' }]} />
        <section
          aria-labelledby="explore-title"
          className="border-b border-line py-3"
        >
          <div>
            <h1
              className="font-heading text-2xl font-semibold leading-tight text-ink sm:text-3xl"
              id="explore-title"
            >
              Khám phá workshop
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Lọc theo nơi, thời gian và mức giá để tìm buổi phù hợp.
            </p>
          </div>
        </section>

        <ExploreFilters
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          onLocate={() => void requestLocation(true)}
          provinces={provinceOptions}
          locationError={locationError}
          provinceError={provinceError}
          onAreasChange={setAreaOptions}
          resultCount={totalCount}
          locating={isLocating}
          view={view}
        >
          <label className="relative flex h-11 items-center gap-2 text-sm font-semibold text-ink">
            <span className="sr-only">Sắp xếp</span>
            <select
              className="h-11 w-40 min-w-0 appearance-none rounded-lg border border-[#DDD6C4] bg-white py-0 pl-3 pr-9 text-[13px] font-semibold text-ink placeholder:text-[#7A7367] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 md:w-48"
              value={sort}
              onChange={(event) => updateSort(event.target.value as SortOption)}
            >
              <option value="recommended">Phù hợp nhất</option>
              <option value="soonest">Buổi gần nhất</option>
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
            </select>
            <ChevronDown
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute right-3 text-[#5E584D]"
            />
          </label>
        </ExploreFilters>
        {(countActiveFilters(filters) > 0 || appliedQuery.trim()) && (
          <div className="flex flex-wrap items-center gap-x-3">
            <ActiveFilterChips
              filters={filters}
              provinces={provinceOptions}
              areas={areaOptions}
              onChange={updateFilters}
              compact
            />
            {countActiveFilters(filters) > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 shrink-0 text-sm font-semibold text-primary underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
        <section
          aria-labelledby="workshops-title"
          className="pt-6 scroll-mt-[calc(var(--filter-bar-height,9rem)+3.5rem)]"
          id="workshops"
        >
          <div className="mb-4 flex justify-start">
            <ViewToggle onChange={updateView} value={view} />
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2
              id="workshops-title"
              className="font-heading text-xl font-semibold"
            >
              {view === 'studios' ? 'Studio nổi bật' : 'Workshop sắp tới'}
              {totalCount > 0 && (
                <>
                  {' '}
                  · <span aria-live="polite">{totalCount}</span>
                </>
              )}
            </h2>
            {titleLocation && (
              <p className="text-sm text-stone-600">Ở {titleLocation}</p>
            )}
          </div>
          <WorkshopGrid
            error={
              view === 'studios' ? studiosCatalog.isError : catalog.isError
            }
            loading={
              view === 'studios' ? studiosCatalog.isLoading : catalog.isLoading
            }
            emptyState={
              view === 'workshops' && totalCount === 0 ? (
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <CalendarDays
                    aria-hidden="true"
                    className="mb-4 text-[#5E584D]"
                    size={30}
                  />
                  <h3 className="font-heading text-lg font-semibold text-ink">
                    Chưa có workshop{' '}
                    {filters.categoryId
                      ? getCategoryMeta(filters.categoryId).name
                      : ''}{' '}
                    phù hợp
                  </h3>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
                    >
                      Xóa bộ lọc
                    </button>
                    <Link
                      to={`/dang-nhap?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-[#DDD6C4] bg-white px-4 text-sm font-semibold text-[#2A4710] hover:bg-[#DCEFC8]"
                    >
                      Nhận thông báo khi có lịch
                    </Link>
                  </div>
                </div>
              ) : undefined
            }
            studios={visibleStudios}
            view={view}
            workshops={visibleWorkshops}
          />
          <div ref={nextPageMarker} aria-hidden="true" />
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </section>
      </PageContainer>
    </>
  );
}
