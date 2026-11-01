import * as Popover from '@radix-ui/react-popover';
import { useState, type ReactNode } from 'react';
import { Banknote, ChevronDown, LocateFixed, MapPin } from 'lucide-react';
import type { CatalogFilters } from '../../types/catalog';
import { DateRangePicker } from '../ui/date-range-picker';
import { ProvinceCombobox, type ProvinceOption } from './ProvinceCombobox';
import { PriceFilter } from './PriceFilter';

type Props = {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  provinces: ProvinceOption[];
  onLocate: () => void;
  locating: boolean;
  locationError?: string;
  provinceError?: string;
  stacked?: boolean;
};

function FilterPopover({
  label,
  count,
  icon,
  children,
}: {
  label: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-1.5 text-[13px] text-ink hover:border-primary focus-visible:outline-2 focus-visible:outline-primary lg:gap-1.5 lg:px-2">
        {icon}
        <span>{label}</span>
        {count > 0 && <span className="font-bold">({count})</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={label}
          className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-200 bg-paper p-4 text-ink shadow-overlay"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CatalogFilterFields({
  filters,
  onChange,
  provinces,
  onLocate,
  locating,
  locationError,
  provinceError,
  stacked = false,
}: Props) {
  const [locationRequested, setLocationRequested] = useState(false);
  const provinceFields = (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ProvinceCombobox
            options={provinces}
            value={filters.provinceId}
            onChange={(provinceId) =>
              onChange({ ...filters, provinceId, areaIds: undefined, page: 1 })
            }
          />
        </div>
        <button
          type="button"
          aria-label="Dùng vị trí của tôi"
          title="Dùng vị trí của tôi"
          aria-busy={locating}
          disabled={locating}
          onClick={() => {
            setLocationRequested(true);
            onLocate();
          }}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-[13px] font-semibold text-primary hover:border-primary hover:bg-soft disabled:cursor-wait disabled:opacity-60"
        >
          <LocateFixed
            size={16}
            aria-hidden="true"
            className={locating ? 'motion-safe:animate-spin' : undefined}
          />
          <span className="sr-only">
            {locating ? 'Đang lấy vị trí…' : 'Dùng vị trí của tôi'}
          </span>
        </button>
      </div>
      {provinceError && (
        <p role="status" className="text-[13px] text-stone-600">
          {provinceError}
        </p>
      )}
      {locationRequested && locationError && (
        <p role="status" className="text-[13px] text-stone-600">
          {locationError}
        </p>
      )}
    </div>
  );
  if (stacked)
    return (
      <div className="grid min-w-0 gap-5">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[13px] font-bold text-stone-700">
            Ngày
          </legend>
          <DateRangePicker
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(range) => onChange({ ...filters, ...range, page: 1 })}
          />
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[13px] font-bold text-stone-700">
            Tỉnh / thành phố{filters.provinceId && ' (1)'}
          </legend>
          {provinceFields}
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-3 text-[13px] font-bold text-stone-700">
            Giá
          </legend>
          <PriceFilter filters={filters} onChange={onChange} />
        </fieldset>
      </div>
    );
  return (
    <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
      <DateRangePicker
        compact
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onChange={(range) => onChange({ ...filters, ...range, page: 1 })}
      />
      <FilterPopover
        label="Tỉnh-thành"
        count={Number(Boolean(filters.provinceId))}
        icon={<MapPin size={16} aria-hidden="true" />}
      >
        {provinceFields}
      </FilterPopover>
      <FilterPopover
        label="Giá"
        count={Number(
          filters.priceMin !== undefined || filters.priceMax !== undefined,
        )}
        icon={<Banknote size={16} aria-hidden="true" />}
      >
        <PriceFilter filters={filters} onChange={onChange} />
      </FilterPopover>
    </div>
  );
}
