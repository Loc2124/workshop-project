import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import { useEffect, useId, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '../ui/button';
type Option = { value: string; label: string };
export function SearchableFilterSelect({
  label,
  value,
  onChange,
  loadOptions,
  emptyLabel = 'Tất cả',
  allowClear = true,
  disabled = false,
  excludedValues = [],
  searchPlaceholder = 'Tìm tên studio…',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  loadOptions: (q: string, signal: AbortSignal) => Promise<Option[]>;
  emptyLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
  excludedValues?: string[];
  searchPlaceholder?: string;
}) {
  const userId = useAuth().user?.id;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<Option | null>(null);
  const id = useId();
  useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const options = useQuery({
    queryKey: queryKeys.options.list(userId, { label, q }),
    queryFn: ({ signal }) => loadOptions(q, signal),
    enabled: open,
  });
  const text =
    options.data?.find((o) => o.value === value)?.label ??
    (chosen?.value === value
      ? chosen.label
      : value
        ? 'Studio đã chọn'
        : emptyLabel);
  function select(option: Option) {
    setChosen(option);
    onChange(option.value);
    setOpen(false);
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          aria-label={label}
          disabled={disabled}
          className="min-w-48 justify-between font-normal"
        >
          {text}
          <ChevronDown size={14} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 w-72 rounded-sm border border-line bg-surface p-2 shadow-sm"
        >
          <input
            autoFocus
            aria-label={`Tìm ${label.toLowerCase()}`}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 min-h-11 w-full rounded-sm border border-line px-3 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                document
                  .getElementById(id)
                  ?.querySelector<HTMLButtonElement>('button')
                  ?.focus();
              }
            }}
          />
          <div
            id={id}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              const buttons = Array.from(
                e.currentTarget.querySelectorAll('button'),
              );
              const n = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              buttons[
                (n + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                  buttons.length
              ]?.focus();
            }}
          >
            {allowClear && (
              <button
                role="option"
                aria-selected={!value}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-soft focus:bg-soft"
                onClick={() => select({ value: '', label: 'Tất cả' })}
              >
                Tất cả{!value && <Check size={14} />}
              </button>
            )}
            {options.data
              ?.filter((o) => !excludedValues.includes(o.value))
              .map((o) => (
                <button
                  key={o.value}
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => select(o)}
                  className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-soft focus:bg-soft"
                >
                  {o.label}
                  {value === o.value && <Check size={14} />}
                </button>
              ))}
          </div>
          {options.isPending && (
            <p className="p-3 text-xs text-muted">Đang tải…</p>
          )}
          {options.error && (
            <Button variant="outline" onClick={() => void options.refetch()}>
              Thử lại
            </Button>
          )}
          {options.data?.filter(
            (option) => !excludedValues.includes(option.value),
          ).length === 0 && (
            <p className="p-3 text-xs text-muted">
              Không tìm thấy mục phù hợp.
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
