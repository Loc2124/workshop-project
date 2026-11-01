import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  LocateFixed,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import type { CatalogFilters } from '../../types/catalog';
import { AreaMultiSelect, type AreaOption } from './AreaMultiSelect';
import { Button } from '../ui/button';
import { DateRangePicker } from '../ui/date-range-picker';
import { PriceRangeSlider } from '../ui/price-range-slider';
import { ProvinceCombobox, type ProvinceOption } from './ProvinceCombobox';

type Props = {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onClear: () => void;
  compact?: boolean;
  sidebar?: boolean;
  provinces?: ProvinceOption[];
  locationError?: string;
  provinceError?: string;
  onLocate?: () => void;
  locating?: boolean;
  onAreasChange?: (areas: AreaOption[]) => void;
};

export function HorizontalFilterBar({
  filters,
  onChange,
  onClear,
  compact = false,
  sidebar = false,
  provinces,
  locationError,
  provinceError,
  onLocate,
  locating = false,
  onAreasChange,
}: Props) {
  const filterRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const update = (patch: Partial<CatalogFilters>) =>
    onChange({ ...filters, ...patch, page: 1 });
  const activeCount = [
    filters.categoryId,
    filters.dateFrom || filters.dateTo,
    filters.provinceId,
    filters.areaIds?.length,
    filters.priceMin !== undefined || filters.priceMax !== undefined,
    filters.level,
    filters.audience,
    filters.takeawaySameDay,
  ].filter(Boolean).length;

  useEffect(() => {
    if (compact || sidebar) return;
    const updateStickyState = () => {
      const top = filterRef.current?.getBoundingClientRect().top ?? 1;
      setIsSticky(top <= 0);
    };
    updateStickyState();
    window.addEventListener('scroll', updateStickyState, { passive: true });
    return () => window.removeEventListener('scroll', updateStickyState);
  }, [compact, sidebar]);

  const quickPrices = [
    { label: 'Dưới 300k', min: 0, max: 299_999 },
    { label: '300–600k', min: 300_000, max: 600_000 },
    { label: 'Trên 600k', min: 600_001, max: undefined },
  ];

  return (
    <div
      ref={filterRef}
      className={
        sidebar
          ? 'rounded-md border border-line bg-surface p-4'
          : compact
            ? 'bg-paper py-3'
            : `sticky top-0 z-30 -mx-6 bg-paper/95 px-6 backdrop-blur lg:-mx-10 lg:px-10 ${
                isSticky ? 'py-2' : 'py-3'
              }`
      }
    >
      {!compact && (
        <div
          className={`${
            sidebar ? 'mb-4' : 'mb-3 px-2'
          } ${isSticky && !sidebar ? 'hidden' : ''}`}
        >
          <div className="flex items-center gap-2">
            <h3 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal
                aria-hidden="true"
                className="shrink-0 text-muted"
                size={16}
              />
              Lọc workshop
            </h3>
            {!sidebar && activeCount > 0 && (
              <Button
                variant="link"
                size="sm"
                className="min-h-9 shrink-0 rounded-lg px-2 text-sm font-semibold text-porcelain underline-offset-4 hover:underline"
                onClick={onClear}
                type="button"
              >
                Xóa lọc ({activeCount})
              </Button>
            )}
          </div>
          {sidebar && (
            <Button
              type="button"
              variant="link"
              onClick={onClear}
              disabled={activeCount === 0}
              className="mt-2 min-h-11 px-0 text-sm"
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      )}

      <div
        className={`grid gap-4 ${
          sidebar
            ? 'grid-cols-1 items-stretch gap-7'
            : isSticky && !compact
              ? 'grid-cols-2 items-center xl:grid-cols-4 xl:gap-3'
              : 'lg:grid-cols-2 lg:items-start xl:grid-cols-4 xl:gap-4'
        }`}
      >
        <fieldset className="min-w-0">
          {(!isSticky || sidebar) && (
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays aria-hidden="true" size={16} />
              Thời gian
            </legend>
          )}
          <DateRangePicker
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(range) => update(range)}
          />
        </fieldset>

        <fieldset className="min-w-0">
          {(!isSticky || sidebar) && (
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin aria-hidden="true" size={16} />
              Tỉnh / thành phố
            </legend>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <ProvinceCombobox
                options={provinces}
                value={filters.provinceId}
                onChange={(provinceId) =>
                  update({ provinceId, areaIds: undefined })
                }
              />
            </div>
            {onLocate && (
              <button
                aria-label="Dùng vị trí hiện tại"
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain disabled:opacity-60"
                disabled={locating}
                onClick={onLocate}
                title="Dùng vị trí hiện tại"
                type="button"
              >
                <LocateFixed aria-hidden="true" size={17} />
              </button>
            )}
          </div>
          {locationError && (
            <p className="mt-2 text-sm font-semibold text-brick" role="status">
              {locationError}
            </p>
          )}
          {provinceError && (
            <p className="mt-2 text-sm font-semibold text-brick" role="status">
              {provinceError}
            </p>
          )}
        </fieldset>

        <fieldset className="min-w-0">
          {(!isSticky || sidebar) && (
            <legend className="mb-2 text-sm font-semibold text-ink">
              Khoảng giá (₫)
            </legend>
          )}
          <PriceRangeSlider
            priceMin={filters.priceMin}
            priceMax={filters.priceMax}
            onChange={(range) => update(range)}
          />
          <div className="mt-3 grid grid-cols-1 gap-2">
            {quickPrices.map((range) => {
              const selected =
                filters.priceMin === range.min &&
                filters.priceMax === range.max;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain ${
                    selected
                      ? 'border-forest bg-forest text-white'
                      : 'border-line bg-surface text-ink hover:border-forest'
                  }`}
                  key={range.label}
                  onClick={() =>
                    update({ priceMin: range.min, priceMax: range.max })
                  }
                  type="button"
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <AreaMultiSelect
          provinceId={filters.provinceId}
          selectedIds={filters.areaIds ?? []}
          onChange={(areaIds) => update({ areaIds })}
          onOptionsChange={onAreasChange}
        />
        {isSticky && activeCount > 0 && (
          <Button
            className="min-h-11"
            onClick={onClear}
            type="button"
            variant="outline"
          >
            Xóa ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
