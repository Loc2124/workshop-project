import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { CatalogFilters } from '@/types/catalog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { CatalogFilterFields } from './CatalogFilterFields';
import type { AreaOption } from './AreaMultiSelect';
import { type CatalogView } from './ViewToggle';
import type { ProvinceOption } from './ProvinceCombobox';

type Props = {
  children?: ReactNode;
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onClear: () => void;
  provinces: ProvinceOption[];
  onLocate: () => void;
  locating: boolean;
  onAreasChange: (areas: AreaOption[]) => void;
  locationError?: string;
  provinceError?: string;
  resultCount: number;
  view: CatalogView;
};

export function countActiveFilters(filters: CatalogFilters) {
  return [
    filters.categoryId,
    filters.provinceId,
    filters.areaIds?.length,
    filters.dateFrom || filters.dateTo,
    filters.priceMin !== undefined || filters.priceMax !== undefined,
    filters.level,
    filters.audience,
    filters.takeawaySameDay,
  ].filter(Boolean).length;
}

export function MobileFilterSheet({
  filters,
  onChange,
  onClear,
  provinces,
  onLocate,
  locating,
  locationError,
  provinceError,
  resultCount,
  view,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      <div className="md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forest px-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain"
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" size={16} />
                <span>Bộ lọc{activeCount > 0 && ` (${activeCount})`}</span>
              </button>
            </DialogTrigger>
            <DialogContent
              className="h-[min(90dvh,720px)] bg-paper md:hidden"
              sheet
            >
              <div className="flex h-full min-h-0 flex-col">
                <header className="border-b border-line px-5 py-4 pr-14">
                  <DialogTitle className="font-heading text-xl font-semibold leading-tight text-ink">
                    Bộ lọc {view === 'studios' ? 'studio' : 'workshop'}
                  </DialogTitle>
                  <DialogDescription
                    aria-live="polite"
                    className="mt-1 text-sm font-medium text-stone-600"
                  >
                    {resultCount} {view === 'studios' ? 'studio' : 'workshop'}{' '}
                    phù hợp
                  </DialogDescription>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-5">
                  <div className="py-5">
                    <CatalogFilterFields
                      stacked
                      filters={filters}
                      onChange={onChange}
                      provinces={provinces}
                      onLocate={onLocate}
                      locating={locating}
                      locationError={locationError}
                      provinceError={provinceError}
                    />
                  </div>
                  {children && (
                    <fieldset className="grid gap-2 pb-5">
                      <legend className="mb-2 text-[13px] font-bold text-stone-700">
                        Sắp xếp
                      </legend>
                      {children}
                    </fieldset>
                  )}
                </div>
                <footer className="mt-auto flex shrink-0 items-center gap-3 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button
                    className="h-12 flex-1 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:border-porcelain disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeCount === 0}
                    onClick={onClear}
                    type="button"
                  >
                    Xóa
                  </button>
                  <DialogClose asChild>
                    <button
                      className="h-12 flex-[2] rounded-lg bg-porcelain px-4 text-base font-semibold text-white hover:bg-porcelain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain"
                      type="button"
                    >
                      Xem {resultCount} kết quả
                    </button>
                  </DialogClose>
                </footer>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
