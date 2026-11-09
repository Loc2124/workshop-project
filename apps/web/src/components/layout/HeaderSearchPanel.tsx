import {
  useCallback,
  useEffect,
  useId,
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
import { normalizeSearchText } from '../../lib/search';
import { searchQuerySchema } from '../../lib/form-validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const needle = normalizeSearchText(query);
  if (!needle) return text;
  const positions: Array<{ start: number; end: number }> = [];
  let normalized = '';
  let offset = 0;
  for (const character of text) {
    const start = offset;
    offset += character.length;
    const normalizedCharacter = normalizeSearchText(character);
    normalized += normalizedCharacter;
    for (let index = 0; index < normalizedCharacter.length; index++)
      positions.push({ start, end: offset });
  }
  const found = normalized.indexOf(needle);
  if (found < 0 || !positions[found] || !positions[found + needle.length - 1])
    return text;
  const start = positions[found].start;
  const end = positions[found + needle.length - 1].end;
  return (
    <>
      {text.slice(0, start)}
      <strong className="font-bold text-ink">{text.slice(start, end)}</strong>
      {text.slice(end)}
    </>
  );
}

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
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [active, setActive] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const [emptyPanelRequested, setEmptyPanelRequested] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('open-slot.recent-searches') ?? '[]').slice(0, 4);
    } catch {
      return [];
    }
  });
  const catalog = useCategoryCatalog();
  const workshops = catalog.items;
  const suggestions = useMemo(
    () => getSearchSuggestions(workshops, debouncedQuery),
    [workshops, debouncedQuery, categories],
  );
  const popularSuggestions: SearchSuggestion[] = useMemo(() => {
    const fromCatalog = getSearchSuggestions(workshops, '');
    if (fromCatalog.length) return fromCatalog.slice(0, 5);
    return categories
      .filter((category) => category.status === 'active' && category.isVisible !== false)
      .slice(0, 5)
      .map((category) => ({
        id: `category-${category.id}`,
        categoryId: category.id,
        group: 'Bộ môn' as const,
        label: category.name,
        href: `/kham-pha?type=${encodeURIComponent(category.slug)}&view=workshop`,
      }));
  }, [workshops, categories]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const hasQuery = Boolean(query.trim());
  const showSuggestions = hasQuery
    ? Boolean(debouncedQuery) && debouncedQuery === query.trim()
    : emptyPanelRequested && (popularSuggestions.length > 0 || recentSearches.length > 0);
  const panelVisible = inputFocused && showSuggestions;

  const close = useCallback((restoreFocus = true) => {
    onOpenChange(false);
    setInputFocused(false);
    setEmptyPanelRequested(false);
    setActive(-1);
    if (restoreFocus)
      requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onOpenChange]);
  const show = useCallback(() => {
    setEmptyPanelRequested(false);
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
  useEffect(() => {
    if (previousLocation.current !== location.key) {
      previousLocation.current = location.key;
      setQuery(new URLSearchParams(location.search).get('q') ?? '');
      setEmptyPanelRequested(false);
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
        if (panelVisible) setInputFocused(false);
        else close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        open &&
        !mobile &&
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        if (!query.trim()) close(false);
        else setInputFocused(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, mobile, show, close, query, panelVisible]);
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
    if (value) saveRecent(value);
    go(value ? `/kham-pha?${new URLSearchParams({ q: value })}` : '/kham-pha');
  };
  const activeItems = hasQuery
    ? suggestions.length > 0 || !debouncedQuery
      ? suggestions
      : popularSuggestions.slice(0, 3)
    : popularSuggestions;
  const groups = ['Workshop', 'Studio', 'Bộ môn'] as const;
  const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (panelVisible) {
        setInputFocused(false);
        setActive(-1);
      } else {
        close();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const max = activeItems.length + (!hasQuery ? recentSearches.length : 1);
      if (max > 0)
        setActive((current) =>
          event.key === 'ArrowDown'
            ? (current + 1) % max
            : current <= 0
              ? max - 1
              : current - 1,
        );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0 && active < activeItems.length)
        {
          if (hasQuery) saveRecent(query.trim());
          choose(activeItems[active]);
        }
      else if (!hasQuery && active >= activeItems.length && recentSearches[active - activeItems.length]) {
        setQuery(recentSearches[active - activeItems.length]);
        setActive(-1);
        inputRef.current?.focus();
      } else submit();
    }
  };
  const searchForm = () => (
    <form
      noValidate
      role="search"
      aria-label="Tìm kiếm trên Open Slot"
      className="relative flex h-11 min-h-11 w-full items-center rounded-xl border border-line bg-surface transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {mobile && <Search size={18} aria-hidden="true" className="ml-3 shrink-0 text-stone-600" />}
      <input
        ref={inputRef}
        aria-label="Tìm bộ môn, studio, workshop"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={panelVisible}
        aria-controls={panelVisible ? listId : undefined}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        type="search"
        maxLength={200}
        aria-invalid={Boolean(searchError) || undefined}
        aria-describedby={searchError ? `${listId}-error` : undefined}
        value={query}
        placeholder="Tìm workshop..."
        tabIndex={open ? 0 : -1}
        onChange={(event) => {
          if (!event.target.value.trim() && query.trim())
            setEmptyPanelRequested(true);
          setQuery(event.target.value);
          setInputFocused(true);
          setSearchError('');
          setActive(-1);
        }}
        onClick={() => {
          if (!query.trim()) setEmptyPanelRequested(true);
          setInputFocused(true);
        }}
        onFocus={() => setInputFocused(true)}
        onKeyDown={keyboard}
        onBlur={() => {
          setInputFocused(false);
        }}
        className={`h-11 min-h-11 min-w-0 flex-1 rounded-xl bg-transparent text-sm text-ink outline-none placeholder:text-[#7A7367] [&::-webkit-search-cancel-button]:hidden ${mobile ? 'pl-2 pr-12' : 'pl-3 pr-20'}`}
      />
      {query && (
        <button
          type="button"
          aria-label="Xóa nội dung tìm kiếm"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setQuery('');
            setEmptyPanelRequested(true);
            inputRef.current?.focus();
          }}
          className={`absolute top-0 z-20 grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-soft ${mobile ? 'right-0' : 'right-11'}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
      {!mobile && <button
        ref={triggerRef}
        type="button"
        aria-label={!open ? 'Tìm kiếm' : query.trim() ? 'Tìm kiếm' : 'Thu gọn tìm kiếm'}
        title="Tìm kiếm"
        aria-expanded={open}
        aria-controls={`${listId}-panel`}
        onClick={() => {
          if (!open) show();
          else if (query.trim()) submit();
          else close();
        }}
        className="absolute right-0 top-0 z-30 grid size-11 place-items-center rounded-lg text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>}
    </form>
  );
  const saveRecent = (value: string) => {
    const nextRecent = [value, ...recentSearches.filter((item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase())].slice(0, 4);
    setRecentSearches(nextRecent);
    try {
      localStorage.setItem('open-slot.recent-searches', JSON.stringify(nextRecent));
    } catch {
      // Recent searches are optional.
    }
  };
  const options = (
    <div id={listId} role="listbox" aria-label="Gợi ý tìm kiếm" className="p-3">
      {searchError && <p id={`${listId}-error`} role="alert" className="mb-3 text-sm text-brick">{searchError}</p>}
      {!hasQuery && popularSuggestions.length > 0 && (
        <section aria-label="Bộ môn phổ biến" className="mb-3">
          <h2 className="mb-2 text-[13px] font-semibold text-stone-700">Bộ môn phổ biến</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Bộ môn phổ biến">
            {popularSuggestions.map((suggestion, index) => {
              const Icon = getCategoryIcon(suggestion.categoryId);
              return <button key={suggestion.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={active === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(suggestion)} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink hover:bg-soft', active === index && 'bg-soft ring-1 ring-primary')}><Icon size={14} aria-hidden="true" />{suggestion.label}</button>;
            })}
          </div>
        </section>
      )}
      {!hasQuery && recentSearches.length > 0 && (
        <section aria-label="Tìm gần đây" className="mb-3">
          <h2 className="mb-2 text-[13px] font-semibold text-stone-700">Tìm gần đây</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tìm gần đây">
            {recentSearches.map((item, index) => <button key={item} id={`${listId}-${popularSuggestions.length + index}`} type="button" role="option" aria-selected={active === popularSuggestions.length + index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(popularSuggestions.length + index)} onClick={() => { setQuery(item); setActive(-1); inputRef.current?.focus(); }} className={cn('min-h-9 rounded-full border border-line px-3 text-xs font-semibold text-stone-700 hover:bg-soft', active === popularSuggestions.length + index && 'bg-soft ring-1 ring-primary')}>{item}</button>)}
          </div>
        </section>
      )}
      {hasQuery && debouncedQuery && suggestions.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => {
            const entries = suggestions.filter((suggestion) => suggestion.group === group).slice(0, 3);
            if (!entries.length) return null;
            return <section key={group} role="group" aria-label={group}>
              <h2 className="px-2 pb-1 text-xs font-semibold text-stone-600">{group}</h2>
              {entries.map((suggestion) => {
                const index = suggestions.indexOf(suggestion);
                const Icon = group === 'Bộ môn' ? getCategoryIcon(suggestion.categoryId) : group === 'Studio' ? Store : Ticket;
                return <button key={suggestion.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active} tabIndex={-1} title={[suggestion.label, suggestion.detail].filter(Boolean).join(' · ')} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => { if (hasQuery) saveRecent(query.trim()); choose(suggestion); }} className={cn('flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-ink hover:bg-soft', index === active && 'bg-soft ring-1 ring-primary')}>
                  <Icon size={16} aria-hidden="true" className="shrink-0 text-stone-600" />
                  <span className="min-w-0 flex-1 truncate font-medium"><HighlightMatch text={suggestion.label} query={debouncedQuery} /></span>
                  {suggestion.detail && <span className="max-w-40 truncate text-xs text-muted">{suggestion.detail}</span>}
                </button>;
              })}
            </section>;
          })}
        </div>
      )}
      {hasQuery && debouncedQuery && catalog.isLoading && (
        <p role="status" className="py-3 text-sm text-muted">Đang tìm gợi ý…</p>
      )}
      {hasQuery && debouncedQuery && !catalog.isLoading && suggestions.length === 0 && (
        <div role="group" aria-label="Không có kết quả phù hợp" className="py-2">
          <p role="status" className="mb-3 text-sm font-medium">Không tìm thấy “{debouncedQuery}”</p>
          {popularSuggestions.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Bộ môn phổ biến">
            {popularSuggestions.slice(0, 3).map((suggestion, index) => <button key={suggestion.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={active === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(suggestion)} className={cn('min-h-9 rounded-full border border-line px-3 text-xs font-semibold text-primary hover:bg-soft', active === index && 'bg-soft ring-1 ring-primary')}>{suggestion.label}</button>)}
          </div>}
        </div>
      )}
      {hasQuery && debouncedQuery && (
        <button id={`${listId}-${activeItems.length}`} type="button" role="option" aria-selected={active === activeItems.length} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(activeItems.length)} onClick={() => submit()} className={cn('mt-2 flex min-h-11 w-full items-center rounded-lg border-t border-line px-2 text-left text-sm font-semibold text-primary hover:bg-soft', active === activeItems.length && 'bg-soft ring-1 ring-primary')}>
          Xem tất cả kết quả cho ‘{debouncedQuery}’
        </button>
      )}
    </div>
  );

  return mobile ? (
    <div className="relative flex w-11 shrink-0 justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Đóng tìm kiếm' : 'Tìm kiếm'}
        title="Tìm kiếm"
        aria-expanded={open}
        aria-controls={`${listId}-overlay`}
        onClick={() => (open ? close() : show())}
        className="grid size-11 place-items-center rounded-lg text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={(value) => (value ? show() : close())}>
        <DialogContent
          ref={mobileRef}
          id={`${listId}-overlay`}
          hideClose
          className="bottom-0 left-0 right-0 top-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 bg-paper p-4 shadow-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            if (panelVisible) {
              setInputFocused(false);
              setActive(-1);
            } else close();
          }}
        >
          <DialogTitle className="sr-only">Tìm kiếm</DialogTitle>
          <DialogDescription className="sr-only">Tìm bộ môn, studio và workshop.</DialogDescription>
          <div className="flex items-center gap-3">
            <div ref={rootRef} className="min-w-0 flex-1">{searchForm()}</div>
            <button type="button" onClick={() => close()} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-primary">Hủy</button>
          </div>
          {panelVisible && <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-paper">{options}</div>}
        </DialogContent>
      </Dialog>
    </div>
  ) : (
    <div
      ref={rootRef}
      className={cn(
        'relative h-11 shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none',
        open ? 'w-[clamp(200px,17vw,260px)]' : 'w-11',
      )}
    >
      <div className="h-11 w-full">{searchForm()}</div>
      {panelVisible && (
        <div
          id={`${listId}-panel`}
          className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(28rem,calc(100dvh-6rem))] w-[max(100%,360px)] min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-line bg-paper shadow-overlay"
        >
          {options}
        </div>
      )}
    </div>
  );
}
