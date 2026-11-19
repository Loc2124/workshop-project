import { X } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { CatalogFilters } from '@/types/catalog';
import type { AreaOption } from './AreaMultiSelect';
import type { ProvinceOption } from './ProvinceCombobox';

type Props = {
  filters: CatalogFilters;
  provinces: ProvinceOption[];
  areas: AreaOption[];
  onChange: (filters: CatalogFilters) => void;
  compact?: boolean;
};

export function ActiveFilterChips({
  filters,
  provinces,
  areas,
  onChange,
  compact = false,
}: Props) {
  const chips: Array<{ label: string; clear: () => CatalogFilters }> = [];
  // The selected category is already represented by the shortcut chip above.
  if (filters.provinceId) {
    const province = provinces.find((item) => item.id === filters.provinceId);
    chips.push({
      label: province?.name ?? filters.provinceId,
      clear: () => ({ ...filters, provinceId: undefined, areaIds: undefined }),
    });
  }
  for (const areaId of filters.areaIds ?? []) {
    const area = areas.find((item) => item.id === areaId);
    chips.push({
      label: area?.name ?? 'Khu vực',
      clear: () => ({
        ...filters,
        areaIds: (filters.areaIds ?? []).filter((id) => id !== areaId),
      }),
    });
  }
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      label: `${filters.dateFrom ?? '…'} – ${filters.dateTo ?? '…'}`,
      clear: () => ({ ...filters, dateFrom: undefined, dateTo: undefined }),
    });
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    chips.push({
      label: `${filters.priceMin === undefined ? '0' : formatPrice(filters.priceMin)}–${filters.priceMax === undefined ? '∞' : formatPrice(filters.priceMax)} ₫`,
      clear: () => ({ ...filters, priceMin: undefined, priceMax: undefined }),
    });
  }
  if (filters.level) {
    chips.push({
      label: filters.level,
      clear: () => ({ ...filters, level: undefined }),
    });
  }
  if (filters.audience) {
    chips.push({
      label: filters.audience,
      clear: () => ({ ...filters, audience: undefined }),
    });
  }
  if (filters.takeawaySameDay) {
    chips.push({
      label: 'Mang về trong ngày',
      clear: () => ({ ...filters, takeawaySameDay: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      aria-label="Bộ lọc đang áp dụng"
      className={`flex gap-1.5 ${
        compact ? 'flex-nowrap overflow-x-auto py-1' : 'flex-wrap gap-2 py-3'
      }`}
    >
      {chips.map((chip, index) => (
        <button
          aria-label={`Bỏ bộ lọc ${chip.label}`}
          className={`inline-flex items-center gap-2 border border-line bg-surface font-semibold text-ink hover:border-porcelain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain ${
            compact
              ? 'min-h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs'
              : 'min-h-11 rounded-sm px-3 text-sm'
          }`}
          key={`${chip.label}-${index}`}
          onClick={() => onChange(chip.clear())}
          type="button"
        >
          <span>{chip.label}</span>
          <X aria-hidden="true" size={14} />
        </button>
      ))}
    </div>
  );
}
