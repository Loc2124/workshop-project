import { useEffect, useState } from 'react';
import type { CatalogFilters } from '../../types/catalog';
import { PriceRangeSlider } from '../ui/price-range-slider';

type Props = {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
};

export function PriceFilter({ filters, onChange }: Props) {
  const [min, setMin] = useState(String(filters.priceMin ?? ''));
  const [max, setMax] = useState(String(filters.priceMax ?? ''));
  const [error, setError] = useState('');
  useEffect(() => {
    setMin(String(filters.priceMin ?? ''));
    setMax(String(filters.priceMax ?? ''));
    setError('');
  }, [filters.priceMin, filters.priceMax]);
  const commit = () => {
    const priceMin = min.trim() === '' ? undefined : Number(min);
    const priceMax = max.trim() === '' ? undefined : Number(max);
    if (
      [priceMin, priceMax].some(
        (value) =>
          value !== undefined && (!Number.isSafeInteger(value) || value < 0),
      )
    ) {
      setError('Nhập giá là số nguyên không âm.');
      return;
    }
    if (
      priceMin !== undefined &&
      priceMax !== undefined &&
      priceMin > priceMax
    ) {
      setError('Giá tối đa cần lớn hơn hoặc bằng giá tối thiểu.');
      return;
    }
    setError('');
    onChange({ ...filters, priceMin, priceMax, page: 1 });
  };
  return (
    <div className="w-full min-w-0 space-y-4">
      <PriceRangeSlider
        priceMin={filters.priceMin}
        priceMax={filters.priceMax}
        onChange={(range) => onChange({ ...filters, ...range, page: 1 })}
      />
      <div
        className="grid grid-cols-2 gap-3"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      >
        <label className="grid min-w-0 gap-1.5 text-[13px] text-stone-700">
          Tối thiểu (₫)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={min}
            placeholder="0"
            aria-label="Giá tối thiểu"
            aria-invalid={Boolean(error)}
            onChange={(event) => setMin(event.target.value)}
            onBlur={commit}
            className="h-11 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 text-sm tabular-nums text-ink placeholder:text-[#7A7367]"
          />
        </label>
        <label className="grid min-w-0 gap-1.5 text-[13px] text-stone-700">
          Tối đa (₫)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={max}
            placeholder="Không giới hạn"
            aria-label="Giá tối đa"
            aria-invalid={Boolean(error)}
            onChange={(event) => setMax(event.target.value)}
            onBlur={commit}
            className="h-11 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 text-sm tabular-nums text-ink placeholder:text-[#7A7367]"
          />
        </label>
      </div>
      {error && (
        <p role="status" className="text-[13px] text-stone-600">
          {error}
        </p>
      )}
    </div>
  );
}
