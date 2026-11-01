import { useEffect, useId, useState } from 'react';
import { catalogService } from '../../services/catalogService';
import { Input } from '../ui/input';

export type ProvinceOption = {
  id: string;
  name: string;
  studioCount: number;
};

type Props = {
  value?: string;
  options?: ProvinceOption[];
  loading?: boolean;
  onChange: (provinceId?: string) => void;
};

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function ProvinceCombobox({
  value,
  options: suppliedOptions,
  loading = false,
  onChange,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (suppliedOptions) {
      setProvinces(
        suppliedOptions.filter((province) => province.studioCount > 0),
      );
      setLoadError(undefined);
      return;
    }
    const controller = new AbortController();
    catalogService
      .provinces(controller.signal)
      .then(({ provinces: provinceOptions }) => {
        setProvinces(
          provinceOptions.filter((province) => province.studioCount > 0),
        );
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không tải được danh sách tỉnh/thành.',
        );
      });
    return () => controller.abort();
  }, [suppliedOptions]);

  const selectedProvince = provinces.find((province) => province.id === value);
  const selectedLabel = selectedProvince
    ? `${selectedProvince.name} (${selectedProvince.studioCount})`
    : '';
  useEffect(() => setQuery(selectedLabel), [selectedLabel]);
  const options = provinces.filter((province) =>
    normalizeSearch(province.name).includes(
      normalizeSearch(query === selectedLabel ? '' : query.trim()),
    ),
  );
  const activeOptionId = options[activeIndex]
    ? `${id}-option-${activeIndex}`
    : undefined;

  return (
    <div className="relative">
      <Input
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-expanded={isOpen}
        aria-label="Tìm hoặc chọn tỉnh, thành phố"
        autoComplete="off"
        id={`${id}-input`}
        onBlur={() => {
          setIsOpen(false);
          setQuery(selectedLabel);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setActiveIndex(0);
          setIsOpen(true);
          if (!nextQuery) onChange(undefined);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) setActiveIndex(0);
            else
              setActiveIndex((index) =>
                Math.min(index + 1, options.length - 1),
              );
            setIsOpen(true);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && isOpen && options[activeIndex]) {
            event.preventDefault();
            const province = options[activeIndex];
            setQuery(`${province.name} (${province.studioCount})`);
            setIsOpen(false);
            onChange(province.id);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
            setQuery(selectedLabel);
          }
        }}
        placeholder="Tìm tỉnh / thành phố"
        role="combobox"
        type="search"
        value={query}
      />
      {isOpen && options.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-sm border border-line bg-surface p-1 shadow-overlay"
          id={`${id}-listbox`}
          role="listbox"
        >
          {options.map((province, index) => (
            <li
              aria-selected={province.id === value}
              className={`min-h-11 cursor-pointer list-none rounded-sm px-3 py-2 text-sm text-ink hover:bg-paper focus-visible:bg-paper focus-visible:outline-none ${
                index === activeIndex ? 'bg-paper' : ''
              }`}
              id={`${id}-option-${index}`}
              key={province.id}
              role="option"
              onClick={() => {
                setQuery(`${province.name} (${province.studioCount})`);
                setIsOpen(false);
                onChange(province.id);
              }}
              onMouseDown={(event) => event.preventDefault()}
              tabIndex={-1}
            >
              {province.name} ({province.studioCount})
            </li>
          ))}
        </ul>
      )}
      {isOpen && loadError && provinces.length === 0 && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-brick shadow-overlay">
          {loadError}
        </p>
      )}
      {isOpen && !loadError && options.length === 0 && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-muted shadow-overlay">
          {loading
            ? 'Đang tải danh sách tỉnh/thành...'
            : query.trim()
              ? 'Không tìm thấy tỉnh / thành phố'
              : 'Chưa có tỉnh/thành nào có workshop còn chỗ'}
        </p>
      )}
    </div>
  );
}
