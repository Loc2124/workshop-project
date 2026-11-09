import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import {
  getCategoryIcon,
  getCategoryOptions,
  getUpcomingCategories,
} from '../../constants/categories';
import { normalizeSearchText } from '../../lib/search';
import type { Workshop } from '../../types/workshop';
import type { Category } from '../../constants/categories';

export function CategoryShortcuts({
  selected,
  workshops,
  onSelect,
  variant = 'filter',
  categoryOptions,
}: {
  selected?: string;
  workshops: Workshop[];
  onSelect?: (categoryId?: string) => void;
  variant?: 'filter' | 'home';
  categoryOptions?: Category[];
}) {
  const home = variant === 'home';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const remote = categoryOptions
    ?.filter(
      (category) =>
        category.isVisible !== false &&
        (category.status === 'active' || category.id === 'other'),
    )
    .map((category) => ({ ...category, count: 0 }));
  const available = [...(remote ?? getUpcomingCategories(workshops))].sort(
    (a, b) =>
      Number(a.id === 'other') - Number(b.id === 'other') ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, 'vi'),
  );
  const matches = (remote ?? getCategoryOptions(workshops)).filter((category) =>
    normalizeSearchText(
      [category.name, category.description, ...category.keywords].join(' '),
    ).includes(normalizeSearchText(query)),
  );
  const chipClass = (active: boolean) =>
    `inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-lg border px-4 font-semibold focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-[#DCEFC8] bg-[#DCEFC8] text-[#2A4710]' : 'border-[#DDD6C4] bg-transparent text-[#5E584D] hover:border-primary hover:text-primary'}`;
  const categoryLink = (category: (typeof available)[number], grid = false) => {
    const Icon = getCategoryIcon(category.id);
    return (
      <Link
        key={category.id}
        to={
          home
            ? `/kham-pha?mon=${encodeURIComponent(category.slug)}`
            : `/kham-pha?type=${encodeURIComponent(category.slug)}&view=workshop`
        }
        aria-current={!home && selected === category.id ? 'true' : undefined}
        className={`${chipClass(!home && selected === category.id)} ${grid ? 'min-w-0 px-3 text-sm' : ''}`}
        onClick={(event) => {
          if (!home && onSelect) {
            event.preventDefault();
            onSelect(category.id);
          }
          setQuery('');
          setOpen(false);
        }}
      >
        <Icon size={20} aria-hidden="true" className="shrink-0" />
        <span className={grid ? 'min-w-0 wrap-break-word' : ''}>
          {category.name}
        </span>
        {/* <span className="ml-auto text-[12px] font-normal tabular-nums text-stone-600">
          {category.count}
        </span> */}
      </Link>
    );
  };
  return (
    <nav
      className="category-shortcuts flex min-w-0 items-start gap-3"
      aria-label="Khám phá workshop theo chủ đề"
    >
      <div className="relative min-w-0 flex-1 after:pointer-events-none after:absolute after:right-0 after:top-0 after:hidden after:h-11 after:w-8 after:bg-gradient-to-l after:from-paper after:to-transparent max-[480px]:after:block">
        <div className="flex w-full snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
          {available
            .filter(
              (category) =>
                category.isVisible !== false &&
                (category.status === 'active' || category.id === 'other'),
            )
            .slice(0, 5)
            .map((category) => categoryLink(category))}
        </div>
        <div aria-hidden="true" className="hidden" />
      </div>
      <Popover.Root
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setQuery('');
        }}
      >
        <Popover.Trigger
          title="Thêm bộ môn"
          className={`${chipClass(
            !home &&
              Boolean(
                selected &&
                !available.some(
                  (category) =>
                    category.id === selected && category.status === 'active',
                ),
              ),
          )} ${!home ? 'max-sm:px-3' : ''}`}
        >
          <Plus size={18} aria-hidden="true" />
          <span className={!home ? 'sr-only sm:not-sr-only' : undefined}>
            Thêm bộ môn
          </span>
          {!home && (
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="hidden sm:block"
            />
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            collisionPadding={16}
            aria-label="Thêm bộ môn"
            className="z-50 w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg border border-stone-200 bg-paper p-4 text-ink shadow-overlay"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold">
                Thêm bộ môn
              </h2>
              <Popover.Close
                aria-label="Đóng danh sách môn"
                className="grid size-9 place-items-center rounded hover:bg-soft"
              >
                <X size={18} />
              </Popover.Close>
            </div>
            <label className="mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Tìm bộ môn</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm bộ môn"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#7A7367]"
              />
            </label>
            <div className="max-h-[min(24rem,55dvh)] overflow-y-auto overscroll-contain">
              {(['active', 'pending'] as const).map((status) => {
                const group = matches.filter(
                  (category) => category.status === status,
                );
                return (
                  group.length > 0 && (
                    <section
                      key={status}
                      aria-label={status === 'pending' ? 'Khác' : 'Bộ môn'}
                      className={status === 'pending' ? 'mt-4' : ''}
                    >
                      {status === 'pending' && (
                        <h3 className="mb-2 text-sm font-bold text-stone-700">
                          Khác
                        </h3>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {group.map((category) => categoryLink(category, true))}
                      </div>
                    </section>
                  )
                );
              })}
              {!matches.length && (
                <p role="status" className="py-4 text-sm text-stone-600">
                  Không có bộ môn phù hợp.
                </p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </nav>
  );
}
