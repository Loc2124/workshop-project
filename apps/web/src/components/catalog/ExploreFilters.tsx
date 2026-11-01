import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { CategoryShortcuts } from './CategoryShortcuts';
import { countActiveFilters, MobileFilterSheet } from './MobileFilterSheet';
import { CatalogFilterFields } from './CatalogFilterFields';
import { useCategoryCatalog } from '../../hooks/useCategoryCatalog';

export function ExploreFilters(
  props: ComponentProps<typeof MobileFilterSheet> & { children: ReactNode },
) {
  const { filters, onChange, onClear, children, ...rest } = props;
  const count = countActiveFilters(filters);
  const { items: categoryWorkshops } = useCategoryCatalog();
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    const main = bar?.closest('main');
    if (!bar || !main) return;
    const measure = () =>
      main.style.setProperty(
        '--filter-bar-height',
        `${bar.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      main.style.removeProperty('--filter-bar-height');
    };
  }, []);
  return (
    <div
      ref={barRef}
      className="sticky top-14 z-30 border-b border-line bg-paper/95 py-2 backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <CategoryShortcuts
            workshops={categoryWorkshops}
            selected={filters.categoryId}
            onSelect={(categoryId) =>
              onChange({ ...filters, categoryId, page: 1 })
            }
          />
        </div>
        <div className="shrink-0 md:hidden">
          <MobileFilterSheet
            {...rest}
            filters={filters}
            onChange={onChange}
            onClear={onClear}
          >
            {children}
          </MobileFilterSheet>
        </div>
      </div>
      <div className="hidden flex-wrap items-center gap-2 pt-2 md:flex">
        <CatalogFilterFields {...rest} filters={filters} onChange={onChange} />
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 shrink-0 text-[13px] font-semibold text-primary hover:underline"
          >
            Xóa lọc
          </button>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
