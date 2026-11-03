import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Search, Store, Ticket, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCategoryCatalog } from '../../hooks/useCategoryCatalog';
import { categories, getCategoryIcon } from '../../constants/categories';
import {
  getSearchSuggestions,
  type SearchSuggestion,
} from '../../lib/searchSuggestions';
import { cn } from '../../lib/utils';
import { searchQuerySchema } from '../../lib/form-validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

export function HeaderSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const previousLocation = useRef(location.key);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  const [query, setQuery] = useState(
    () => new URLSearchParams(location.search).get('q') ?? '',
  );
  const [active, setActive] = useState(-1);
  const [searchError, setSearchError] = useState('');
  const [panelWidth, setPanelWidth] = useState(256);
  const catalog = useCategoryCatalog();
  const workshops = catalog.items;
  const suggestions = useMemo(
    () => getSearchSuggestions(workshops, query),
    [workshops, query, categories],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    setActive(-1);
    requestAnimationFrame(() =>
      (
        triggerRef.current ??
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Tìm kiếm"]',
        )
      )?.focus(),
    );
  }, [onOpenChange]);
  const show = useCallback(() => {
    onOpenChange(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onOpenChange]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, mobile]);
  useLayoutEffect(() => {
    if (!open || mobile) return;
    const root = rootRef.current;
    const header = root?.closest('header');
    if (!root || !header) return;
    const nav = header.querySelector<HTMLElement>(
      'nav[aria-label="Điều hướng chính"]',
    );
    const logo = header.querySelector<HTMLElement>(
      'a[aria-label="Open Slot, trang chủ"]',
    );
    const measure = () => {
      const boundary = nav && nav.getClientRects().length ? nav : logo;
      if (!boundary) return;
      const available =
        (triggerRef.current?.getBoundingClientRect().left ??
          root.getBoundingClientRect().right) -
        boundary.getBoundingClientRect().right -
        10;
      setPanelWidth(Math.max(0, Math.min(256, Math.floor(available))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (nav) observer.observe(nav);
    if (logo) observer.observe(logo);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, mobile]);
  useEffect(() => {
    if (previousLocation.current !== location.key) {
      previousLocation.current = location.key;
      setQuery(new URLSearchParams(location.search).get('q') ?? '');
      setActive(-1);
      if (open) close();
    }
  }, [location.key, location.search, open, close]);
  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      );
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') ||
        (event.key === '/' &&
          !editing &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey)
      ) {
        if (document.querySelector('[role="dialog"]') && !mobileRef.current)
          return;
        event.preventDefault();
        show();
      } else if (event.key === 'Escape' && open && !mobile) {
        event.preventDefault();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        open &&
        !mobile &&
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        close();
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, mobile, show, close]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const go = (href: string) => {
    close();
    navigate(href);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  };
  const choose = (suggestion: SearchSuggestion) => go(suggestion.href);
  const submit = () => {
    const parsed = searchQuerySchema.safeParse(
      inputRef.current?.value ?? query,
    );
    if (!parsed.success) {
      setSearchError(parsed.error.issues[0]?.message ?? 'Từ khóa chưa hợp lệ.');
      return;
    }
    setSearchError('');
    const value = parsed.data;
    go(value ? `/kham-pha?${new URLSearchParams({ q: value })}` : '/kham-pha');
  };
  const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length)
        setActive((current) =>
          event.key === 'ArrowDown'
            ? (current + 1) % suggestions.length
            : current <= 0
              ? suggestions.length - 1
              : current - 1,
        );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0 && suggestions[active]) choose(suggestions[active]);
      else submit();
    }
  };
  const searchForm = (overlay: boolean) => (
    <form
      noValidate
      className={cn(
        'flex min-h-11 items-center rounded-lg border border-line bg-surface focus-within:border-primary',
        overlay ? 'mr-14' : 'w-full',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Search
        size={18}
        aria-hidden="true"
        className="ml-3 shrink-0 text-stone-600"
      />
      <input
        ref={inputRef}
        aria-label="Tìm bộ môn, studio, workshop"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        type="search"
        maxLength={200}
        aria-invalid={Boolean(searchError) || undefined}
        aria-describedby={searchError ? `${listId}-error` : undefined}
        value={query}
        placeholder="Tìm bộ môn, studio, workshop…"
        tabIndex={open ? 0 : -1}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearchError('');
          setActive(-1);
        }}
        onKeyDown={keyboard}
        onBlur={(event) => {
          if (
            !query.trim() &&
            !rootRef.current?.contains(event.relatedTarget) &&
            !mobileRef.current?.contains(event.relatedTarget)
          )
            close();
        }}
        className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {!overlay && (
        <button
          type="button"
          aria-label="Đóng tìm kiếm"
          tabIndex={open ? 0 : -1}
          onClick={close}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-600 hover:bg-soft"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </form>
  );
  const options = (
    <div className="p-3">
      {searchError && (
        <p
          id={`${listId}-error`}
          role="alert"
          className="mb-3 text-sm text-brick"
        >
          {searchError}
        </p>
      )}
      {!query.trim() && (
        <p className="mb-2 text-[13px] font-semibold text-stone-700">
          Bộ môn phổ biến
        </p>
      )}
      <div
        id={listId}
        role="listbox"
        aria-label="Gợi ý tìm kiếm"
        className={query.trim() ? 'space-y-2' : 'flex flex-wrap gap-2'}
      >
        {(query.trim()
          ? (['Bộ môn', 'Khác', 'Studio', 'Workshop'] as const)
          : (['Bộ môn', 'Khác'] as const)
        ).map((group) => {
          const entries = suggestions.filter(
            (suggestion) => suggestion.group === group,
          );
          if (!entries.length) return null;
          return (
            <div
              key={group}
              role="group"
              aria-label={group}
              className={query.trim() ? undefined : 'contents'}
            >
              {query.trim() && (
                <p className="px-2 pb-1 text-xs font-semibold text-stone-600">
                  {group}
                </p>
              )}
              {entries.map((suggestion) => {
                const index = suggestions.indexOf(suggestion);
                const Icon =
                  group === 'Bộ môn' || group === 'Khác'
                    ? getCategoryIcon(suggestion.categoryId)
                    : group === 'Studio'
                      ? Store
                      : Ticket;
                return (
                  <button
                    key={suggestion.id}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    title={[suggestion.label, suggestion.detail]
                      .filter(Boolean)
                      .join(' · ')}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(suggestion)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm text-ink hover:bg-soft',
                      query.trim() ? 'w-full' : 'border border-line px-3',
                      index === active && 'bg-soft ring-1 ring-primary',
                    )}
                  >
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-stone-600"
                    />
                    <span className="min-w-0 truncate font-semibold">
                      {suggestion.label}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {query.trim() && !suggestions.length && (
        <p role="status" className="py-3 text-[13px] text-stone-600">
          {catalog.isLoading
            ? 'Đang tìm gợi ý…'
            : catalog.isError
              ? 'Chưa tải được gợi ý. Nhấn Enter để tìm kiếm.'
              : 'Chưa có gợi ý phù hợp. Nhấn Enter để tìm kiếm.'}
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex w-11 shrink-0 justify-end md:w-[15.25rem] lg:w-[11.25rem] xl:w-[15.25rem]"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Tìm kiếm"
        aria-expanded={open}
        aria-controls={mobile ? `${listId}-overlay` : `${listId}-panel`}
        onClick={() => (open ? close() : show())}
        className="grid size-11 place-items-center rounded-lg text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>
      {!mobile && (
        <div
          id={`${listId}-panel`}
          aria-hidden={!open}
          inert={!open}
          style={{ width: open ? panelWidth : 0 }}
          className={cn(
            'absolute right-13 top-0 transition-[width] duration-200 ease-out motion-reduce:transition-none',
            open ? 'visible' : 'invisible pointer-events-none',
          )}
        >
          <div className="overflow-hidden">{searchForm(false)}</div>
          {open && (
            <div className="absolute right-0 top-full mt-2 max-h-[min(28rem,calc(100dvh-5rem))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-paper shadow-overlay">
              {options}
            </div>
          )}
        </div>
      )}
      {mobile && (
        <Dialog
          open={open}
          onOpenChange={(value) => (value ? show() : close())}
        >
          <DialogContent
            ref={mobileRef}
            id={`${listId}-overlay`}
            className="bottom-0 left-0 right-0 top-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 bg-paper p-4 shadow-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <DialogTitle className="sr-only">Tìm kiếm</DialogTitle>
            <DialogDescription className="sr-only">
              Tìm bộ môn, studio và workshop.
            </DialogDescription>
            {searchForm(true)}
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{options}</div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
