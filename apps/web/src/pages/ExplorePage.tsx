import { PageContainer } from '../components/layout/PageContainer';
import { useProvinces } from '../hooks/useProvinces';
import { categories, getCategoryMeta } from '../constants/categories';
import { useCategoriesQuery } from '../hooks/useCategories';
import { provinceSlug } from '../lib/catalog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { AreaOption } from '../components/catalog/AreaMultiSelect';
import { ExploreFilters } from '../components/catalog/ExploreFilters';
import { rankWorkshops } from '../lib/rankWorkshops';
import { Pagination } from '../components/catalog/Pagination';
import { ViewToggle, type CatalogView } from '../components/catalog/ViewToggle';
import { WorkshopGrid } from '../components/catalog/WorkshopGrid';
import { SiteFooter } from '../components/layout/SiteFooter';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { SiteHeader } from '../components/layout/SiteHeader';
import { mockStudios } from '../data/mockStudios';
import { mockWorkshops } from '../data/mockWorkshops';
import { useCatalog, useCatalogStudios } from '../hooks/useCatalog';
import { detectProvinceId } from '../services/locationService';
import type { CatalogFilters, SortOption } from '../types/catalog';
import type { Studio, StudioListing } from '../types/studio';
import type { Workshop } from '../types/workshop';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';
import { isDemoDataMode } from '../lib/data-mode';
import { parseExploreUrl } from '../lib/explore-url';

const pageSize = 12;
const provincePreferenceKey = 'open-slot.province';
const locationAttemptKey = 'open-slot.location-attempted';
const defaultFilters: CatalogFilters = { page: 1, pageSize };

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

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function filterWorkshops(
  workshops: Workshop[],
  filters: CatalogFilters,
  query: string,
) {
  const normalizedQuery = normalizeText(query.trim());
  const hasSessionFilters =
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    Boolean(filters.dateFrom || filters.dateTo);

  return workshops.flatMap((workshop) => {
    if (filters.categoryId && workshop.categoryId !== filters.categoryId)
      return [];
    if (filters.provinceId && workshop.provinceId !== filters.provinceId)
      return [];
    if (
      filters.areaIds?.length &&
      (!workshop.areaId || !filters.areaIds.includes(workshop.areaId))
    )
      return [];
    if (filters.level && workshop.level !== filters.level) return [];
    if (filters.audience && !workshop.audience.includes(filters.audience))
      return [];
    if (filters.takeawaySameDay && !/ngay|ngày/i.test(workshop.takeaway ?? ''))
      return [];

    const sessions = workshop.sessions
      .filter((session) => {
        if (filters.priceMin !== undefined && session.price < filters.priceMin)
          return false;
        if (filters.priceMax !== undefined && session.price > filters.priceMax)
          return false;
        const date = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(session.startsAt));
        if (filters.dateFrom && date < filters.dateFrom) return false;
        if (filters.dateTo && date > filters.dateTo) return false;
        return true;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (hasSessionFilters && sessions.length === 0) return [];

    if (normalizedQuery) {
      const searchable = normalizeText(
        [
          workshop.title,
          workshop.description,
          getCategoryMeta(workshop.categoryId).name,
          getCategoryMeta(workshop.categoryId).description,
          ...getCategoryMeta(workshop.categoryId).keywords,
          workshop.province,
          workshop.studioName,
          workshop.artistName ?? '',
          ...workshop.audience,
        ].join(' '),
      );
      const matchesQuery = normalizedQuery
        .split(/\s+/)
        .some((word) => searchable.includes(word));
      if (!matchesQuery) return [];
    }

    return [
      {
        ...workshop,
        sessions,
        nextStartsAt: sessions[0]?.startsAt ?? workshop.nextStartsAt,
      },
    ];
  });
}

function getWorkshopPrice(workshop: Workshop) {
  return workshop.sessions.length > 0
    ? Math.min(...workshop.sessions.map((session) => session.price))
    : workshop.basePrice;
}

function toStudioListings(
  studios: Studio[],
  workshops: Workshop[],
): StudioListing[] {
  const grouped = new Map<string, Workshop[]>();
  workshops.forEach((workshop) => {
    const group = grouped.get(workshop.studioId) ?? [];
    group.push(workshop);
    grouped.set(workshop.studioId, group);
  });

  return [...grouped].flatMap(([studioId, matches]) => {
    const first = matches[0];
    if (!first) return [];
    const sampleStudio = studios.find((studio) => studio.id === studioId);
    const prices = matches.flatMap((workshop) =>
      workshop.sessions.length > 0
        ? workshop.sessions.map((session) => session.price)
        : [workshop.basePrice],
    );
    return [
      {
        id: studioId,
        slug: sampleStudio?.slug ?? first.studioSlug,
        name: sampleStudio?.name ?? first.studioName,
        description: sampleStudio?.description ?? first.studioDescription ?? '',
        province: sampleStudio?.province ?? first.province,
        provinceId: sampleStudio?.provinceId ?? first.provinceId ?? '',
        areaId: sampleStudio?.areaId ?? first.areaId ?? null,
        areaName: sampleStudio?.areaName ?? null,
        address: sampleStudio?.address ?? first.address ?? '',
        imageUrl:
          sampleStudio?.imageUrl ??
          matches.find((workshop) => workshop.imageUrl)?.imageUrl,
        rating: sampleStudio?.rating,
        reviewCount: sampleStudio?.reviewCount,
        workshopCount: matches.length,
        categoryId: sampleStudio?.categoryId ?? first.categoryId,
        categoryIds: [
          ...new Set(matches.map((workshop) => workshop.categoryId)),
        ],
        startingPrice: Math.min(...prices),
        availableSessions: matches.reduce(
          (total, workshop) =>
            total +
            workshop.sessions.filter((session) => session.availableSeats > 0)
              .length,
          0,
        ),
      },
    ];
  });
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const usingMockData = isDemoDataMode;
  const categoryQuery = useCategoriesQuery(true);
  const categoriesReady = categoryQuery.isSuccess;
  const { provinces: provinceOptions, error: provinceError } = useProvinces();
  const parsedUrl = useMemo(
    () => parseExploreUrl(searchParams, provinceOptions, categoriesReady),
    [searchParams, provinceOptions, categoriesReady, categories],
  );
  const { filters, sort, view, query: appliedQuery } = parsedUrl;
  const [, setAreaOptions] = useState<AreaOption[]>([]);
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
  const catalog = useCatalog(
    requestFilters,
    !usingMockData && view === 'workshops',
  );
  const studiosCatalog = useCatalogStudios(
    requestFilters,
    !usingMockData && view === 'studios',
  );
  const source = usingMockData ? mockWorkshops : (catalog.data?.items ?? []);
  const filteredWorkshops = useMemo(
    () =>
      usingMockData ? filterWorkshops(source, filters, appliedQuery) : source,
    [source, filters, appliedQuery, usingMockData],
  );

  const sortedWorkshops = useMemo(() => {
    if (!usingMockData) return filteredWorkshops;
    const sorted = [...filteredWorkshops];
    if (sort === 'price-asc')
      sorted.sort((a, b) => getWorkshopPrice(a) - getWorkshopPrice(b));
    if (sort === 'price-desc')
      sorted.sort((a, b) => getWorkshopPrice(b) - getWorkshopPrice(a));
    if (sort === 'soonest')
      sorted.sort((a, b) =>
        (a.nextStartsAt ?? '').localeCompare(b.nextStartsAt ?? ''),
      );
    if (sort === 'recommended') return rankWorkshops(sorted, appliedQuery);
    return sorted;
  }, [filteredWorkshops, appliedQuery, sort, usingMockData]);

  const studioListings = useMemo(
    () =>
      usingMockData
        ? toStudioListings(mockStudios, sortedWorkshops)
        : (studiosCatalog.data?.items ?? []),
    [sortedWorkshops, usingMockData, studiosCatalog.data?.items],
  );
  const sortedStudios = useMemo(() => {
    if (!usingMockData) return studioListings;
    if (sort !== 'price-asc' && sort !== 'price-desc') return studioListings;
    return [...studioListings].sort((a, b) =>
      sort === 'price-asc'
        ? a.startingPrice - b.startingPrice
        : b.startingPrice - a.startingPrice,
    );
  }, [sort, studioListings, usingMockData]);
  const apiPagination =
    view === 'studios'
      ? studiosCatalog.data?.pagination
      : catalog.data?.pagination;
  const totalCount = usingMockData
    ? view === 'studios'
      ? sortedStudios.length
      : sortedWorkshops.length
    : (apiPagination?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = usingMockData
    ? Math.min(filters.page, totalPages)
    : filters.page;
  const visibleWorkshops = usingMockData
    ? sortedWorkshops.slice((page - 1) * pageSize, page * pageSize)
    : sortedWorkshops;
  const visibleStudios = usingMockData
    ? sortedStudios.slice((page - 1) * pageSize, page * pageSize)
    : sortedStudios;
  const selectedProvince = provinceOptions.find(
    (province) => province.id === filters.provinceId,
  );

  const updateFilters = useCallback(
    (next: CatalogFilters, switchToWorkshops = false) => {
      const params = new URLSearchParams(searchParams);
      writeFilters(params, { ...next, page: 1, pageSize }, provinceOptions);
      if (switchToWorkshops) params.set('view', 'workshop');
      setSearchParams(params, { replace: true });
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
    setSearchParams(params, { replace: true });
  };
  const updateView = (next: CatalogView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next === 'studios' ? 'studio' : 'workshop');
    params.delete('page');
    setSearchParams(params, { replace: true });
  };
  const clearFilters = () => updateFilters(defaultFilters);
  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    writeFilters(
      params,
      { ...filters, page: nextPage, pageSize },
      provinceOptions,
    );
    setSearchParams(params, { replace: true });
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

  useEffect(() => {
    if (
      !filters.provinceId &&
      !searchParams.has('province') &&
      !searchParams.has('province_id')
    ) {
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
  }, [filters, provinceOptions, requestLocation, updateFilters, searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(parsedUrl.normalizedParams);
    const expectedView = view === 'studios' ? 'studio' : 'workshop';
    if (params.get('view') !== expectedView) params.set('view', expectedView);
    if (params.toString() !== searchParams.toString())
      setSearchParams(params, { replace: true });
  }, [parsedUrl.normalizedParams, searchParams, setSearchParams, view]);

  const titleLocation = selectedProvince?.name.replace(
    'TP. Hồ Chí Minh',
    'TP.HCM',
  );

  return (
    <div className="explore-page min-h-screen bg-paper text-ink">
      <SiteHeader />
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
          <ViewToggle onChange={updateView} value={view} />
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
            <ArrowDownWideNarrow
              aria-hidden="true"
              size={17}
              className="hidden shrink-0 xl:block"
            />
            <span className="sr-only xl:not-sr-only">Sắp xếp</span>
            <select
              className="min-h-11 w-32 min-w-0 rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink focus:border-primary xl:w-auto xl:px-3"
              value={sort}
              onChange={(event) => updateSort(event.target.value as SortOption)}
            >
              <option value="recommended">Phù hợp nhất</option>
              <option value="soonest">Buổi gần nhất</option>
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
            </select>
          </label>
        </ExploreFilters>
        <section
          aria-labelledby="workshops-title"
          className="pt-6 scroll-mt-[calc(var(--filter-bar-height,9rem)+3.5rem)]"
          id="workshops"
        >
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2
              id="workshops-title"
              className="font-heading text-xl font-semibold"
            >
              {view === 'studios' ? 'Studio nổi bật' : 'Workshop sắp tới'} ·{' '}
              <span aria-live="polite">{totalCount}</span>
            </h2>
            {titleLocation && (
              <p className="text-sm text-stone-600">Ở {titleLocation}</p>
            )}
          </div>
          <WorkshopGrid
            error={
              !usingMockData &&
              (view === 'studios' ? studiosCatalog.isError : catalog.isError)
            }
            loading={
              !usingMockData &&
              (view === 'studios'
                ? studiosCatalog.isLoading
                : catalog.isLoading)
            }
            studios={visibleStudios}
            view={view}
            workshops={visibleWorkshops}
          />
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </section>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
