import { Store, Ticket } from 'lucide-react';
import { getCategoryIcon } from '../../../constants/categories';
import type { SearchSuggestion } from '../../../lib/searchSuggestions';
import { cn } from '../../../lib/utils';
import { HighlightMatch } from './HighlightMatch';

export interface SearchSuggestionsDropdownProps {
  listId: string;
  hasQuery: boolean;
  debouncedQuery: string;
  searchError: string;
  popularSuggestions: SearchSuggestion[];
  recentSearches: string[];
  suggestions: SearchSuggestion[];
  activeItems: SearchSuggestion[];
  active: number;
  isLoading: boolean;
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
  onSelectRecent: (item: string) => void;
  onSubmit: () => void;
  onHoverIndex: (index: number) => void;
}

const groups = ['Workshop', 'Studio', 'Bộ môn'] as const;

export function SearchSuggestionsDropdown({
  listId,
  hasQuery,
  debouncedQuery,
  searchError,
  popularSuggestions,
  recentSearches,
  suggestions,
  activeItems,
  active,
  isLoading,
  onSelectSuggestion,
  onSelectRecent,
  onSubmit,
  onHoverIndex,
}: SearchSuggestionsDropdownProps) {
  return (
    <div id={listId} role="listbox" aria-label="Gợi ý tìm kiếm" className="p-3">
      {searchError && (
        <p
          id={`${listId}-error`}
          role="alert"
          className="mb-3 text-sm text-brick"
        >
          {searchError}
        </p>
      )}

      {!hasQuery && popularSuggestions.length > 0 && (
        <section aria-label="Bộ môn phổ biến" className="mb-3">
          <h2 className="mb-2 text-[13px] font-semibold text-stone-700">
            Bộ môn phổ biến
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Bộ môn phổ biến"
          >
            {popularSuggestions.map((suggestion, index) => {
              const Icon = getCategoryIcon(suggestion.categoryId);
              return (
                <button
                  key={suggestion.id}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => onHoverIndex(index)}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink hover:bg-soft',
                    active === index && 'bg-soft ring-1 ring-primary',
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!hasQuery && recentSearches.length > 0 && (
        <section aria-label="Tìm gần đây" className="mb-3">
          <h2 className="mb-2 text-[13px] font-semibold text-stone-700">
            Tìm gần đây
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Tìm gần đây"
          >
            {recentSearches.map((item, index) => (
              <button
                key={item}
                id={`${listId}-${popularSuggestions.length + index}`}
                type="button"
                role="option"
                aria-selected={active === popularSuggestions.length + index}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() =>
                  onHoverIndex(popularSuggestions.length + index)
                }
                onClick={() => onSelectRecent(item)}
                className={cn(
                  'min-h-9 rounded-full border border-line px-3 text-xs font-semibold text-stone-700 hover:bg-soft',
                  active === popularSuggestions.length + index &&
                    'bg-soft ring-1 ring-primary',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {hasQuery && debouncedQuery && suggestions.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => {
            const entries = suggestions
              .filter((suggestion) => suggestion.group === group)
              .slice(0, 3);
            if (!entries.length) return null;
            return (
              <section key={group} role="group" aria-label={group}>
                <h2 className="px-2 pb-1 text-xs font-semibold text-stone-600">
                  {group}
                </h2>
                {entries.map((suggestion) => {
                  const index = suggestions.indexOf(suggestion);
                  const Icon =
                    group === 'Bộ môn'
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
                      onMouseEnter={() => onHoverIndex(index)}
                      onClick={() => onSelectSuggestion(suggestion)}
                      className={cn(
                        'flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-ink hover:bg-soft',
                        index === active && 'bg-soft ring-1 ring-primary',
                      )}
                    >
                      <Icon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-stone-600"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        <HighlightMatch
                          text={suggestion.label}
                          query={debouncedQuery}
                        />
                      </span>
                      {suggestion.detail && (
                        <span className="max-w-40 truncate text-xs text-muted">
                          {suggestion.detail}
                        </span>
                      )}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {hasQuery && debouncedQuery && isLoading && (
        <p role="status" className="py-3 text-sm text-muted">
          Đang tìm gợi ý…
        </p>
      )}

      {hasQuery && debouncedQuery && !isLoading && suggestions.length === 0 && (
        <div
          role="group"
          aria-label="Không có kết quả phù hợp"
          className="py-2"
        >
          <p role="status" className="mb-3 text-sm font-medium">
            Không tìm thấy “{debouncedQuery}”
          </p>
          {popularSuggestions.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Bộ môn phổ biến"
            >
              {popularSuggestions.slice(0, 3).map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => onHoverIndex(index)}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className={cn(
                    'min-h-9 rounded-full border border-line px-3 text-xs font-semibold text-primary hover:bg-soft',
                    active === index && 'bg-soft ring-1 ring-primary',
                  )}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasQuery && debouncedQuery && (
        <button
          id={`${listId}-${activeItems.length}`}
          type="button"
          role="option"
          aria-selected={active === activeItems.length}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHoverIndex(activeItems.length)}
          onClick={onSubmit}
          className={cn(
            'mt-2 flex min-h-11 w-full items-center rounded-lg border-t border-line px-2 text-left text-sm font-semibold text-primary hover:bg-soft',
            active === activeItems.length && 'bg-soft ring-1 ring-primary',
          )}
        >
          Xem tất cả kết quả cho ‘{debouncedQuery}’
        </button>
      )}
    </div>
  );
}
