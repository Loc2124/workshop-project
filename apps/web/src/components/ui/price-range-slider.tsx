import { useId, type CSSProperties } from 'react';

const MAX_PRICE = 1_500_000;
const PRICE_STEP = 50_000;

type Props = {
  priceMin?: number;
  priceMax?: number;
  onChange: (range: { priceMin?: number; priceMax?: number }) => void;
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

export function PriceRangeSlider({ priceMin, priceMax, onChange }: Props) {
  const id = useId();
  const ceiling = Math.max(MAX_PRICE, priceMin ?? 0, priceMax ?? 0);
  const min = priceMin ?? 0;
  const max = priceMax ?? ceiling;
  const minPercent = (min / ceiling) * 100;
  const maxPercent = (max / ceiling) * 100;

  return (
    <div className="grid gap-2">
      <div
        aria-label="Khoảng giá"
        className="price-range-slider"
        style={
          {
            '--range-start': `${minPercent}%`,
            '--range-end': `${maxPercent}%`,
          } as CSSProperties
        }
      >
        <input
          aria-label="Giá thấp nhất"
          className="price-range-slider__input price-range-slider__input--min"
          id={`${id}-min`}
          max={max}
          min="0"
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({
              priceMin: value > 0 ? value : undefined,
              priceMax,
            });
          }}
          step={PRICE_STEP}
          type="range"
          value={min}
        />
        <input
          aria-label="Giá cao nhất"
          className="price-range-slider__input price-range-slider__input--max"
          id={`${id}-max`}
          max={ceiling}
          min={min}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({
              priceMin,
              priceMax: value < ceiling ? value : undefined,
            });
          }}
          step={PRICE_STEP}
          type="range"
          value={max}
        />
      </div>
      <div className="flex justify-between gap-2 text-xs font-medium text-muted">
        <label htmlFor={`${id}-min`}>Từ {formatPrice(min)}</label>
        <label className="text-right" htmlFor={`${id}-max`}>
          Đến {formatPrice(max)}
        </label>
      </div>
    </div>
  );
}
