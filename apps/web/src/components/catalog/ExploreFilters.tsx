import { LoadingState } from '../ui/LoadingState';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { CategoryShortcuts } from './CategoryShortcuts';
import { MobileFilterSheet } from './MobileFilterSheet';
import { CatalogFilterFields } from './CatalogFilterFields';
import { useCategoriesQuery } from '../../hooks/useCategories';

export function ExploreFilters(
  props: ComponentProps<typeof MobileFilterSheet> & { children: ReactNode },
) {
  const { filters, onChange, onClear, children, ...rest } = props;
  const categoryQuery = useCategoriesQuery();
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const main = bar?.closest('main');
    if (!bar || !main) return;
    const observer = new ResizeObserver((entries) => {
      const height =
        entries[0]?.borderBoxSize?.[0]?.blockSize ??
        entries[0]?.contentRect.height;
      if (height !== undefined)
        main.style.setProperty('--filter-bar-height', `${height}px`);
    });
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
            workshops={[]}
            categoryOptions={categoryQuery.data ?? []}
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
      {categoryQuery.isPending && (
        <LoadingState
          label="Đang tải loại workshop…"
          className="py-2 text-xs text-muted"
        />
      )}
      {categoryQuery.error && (
        <div role="alert" className="py-2 text-sm text-brick">
          Chưa tải được loại workshop.{' '}
          <button
            className="underline"
            onClick={() => void categoryQuery.refetch()}
          >
            Thử lại
          </button>
        </div>
      )}
      <div className="hidden flex-wrap items-center gap-2 pt-2 md:flex">
        <CatalogFilterFields {...rest} filters={filters} onChange={onChange} />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
