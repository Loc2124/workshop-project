import * as Popover from '@radix-ui/react-popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  formatCalendarDate,
  getBusinessToday,
  parseCalendarDate,
} from '../../lib/calendar-date';
import { Button } from './button';

type CalendarProps = {
  selected?: DateRange;
  onSelect: (range?: DateRange) => void;
  numberOfMonths: number;
};

const Calendar = lazy(async () => {
  const [dayPicker, locale] = await Promise.all([
    import('react-day-picker'),
    import('react-day-picker/locale/vi'),
  ]);
  return {
    default: function CalendarView(props: CalendarProps) {
      return (
        <dayPicker.DayPicker
          {...props}
          className="date-range-calendar text-xs"
          defaultMonth={props.selected?.from ?? props.selected?.to}
          disabled={{ before: getBusinessToday() }}
          locale={locale.vi}
          min={1}
          mode="range"
          numberOfMonths={props.numberOfMonths}
          weekStartsOn={1}
        />
      );
    },
  };
});

type Props = {
  compact?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onChange: (range: { dateFrom?: string; dateTo?: string }) => void;
};

function formatDateLabel(value?: string) {
  const date = parseCalendarDate(value);
  return date ? format(date, 'dd/MM/yyyy', { locale: vi }) : '';
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [numberOfMonths, setNumberOfMonths] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 639px)').matches
      ? 1
      : 2,
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateNumberOfMonths = (
      event: MediaQueryList | MediaQueryListEvent,
    ) => setNumberOfMonths(event.matches ? 1 : 2);

    updateNumberOfMonths(mediaQuery);
    mediaQuery.addEventListener('change', updateNumberOfMonths);
    return () => mediaQuery.removeEventListener('change', updateNumberOfMonths);
  }, []);
  const parsedFrom = parseCalendarDate(dateFrom);
  const parsedTo = parseCalendarDate(dateTo);
  const isOrdered =
    !parsedFrom || !parsedTo || parsedFrom.getTime() <= parsedTo.getTime();
  const validFrom = isOrdered ? parsedFrom : undefined;
  const validTo = isOrdered ? parsedTo : undefined;
  const selected: DateRange | undefined =
    validFrom || validTo ? { from: validFrom, to: validTo } : undefined;
  const formattedFrom = validFrom ? formatDateLabel(dateFrom) : '';
  const formattedTo = validTo ? formatDateLabel(dateTo) : '';
  const label =
    formattedFrom && formattedTo
      ? `${formattedFrom} – ${formattedTo}`
      : formattedFrom
        ? `Từ ${formattedFrom}`
        : formattedTo
          ? `Đến ${formattedTo}`
          : 'Chọn ngày';

  return (
    <Popover.Root onOpenChange={setIsOpen} open={isOpen}>
      <Popover.Trigger asChild>
        <Button
          aria-label="Chọn khoảng ngày"
          className={
            compact
              ? 'justify-start gap-1.5 border border-line bg-surface px-2 text-left text-[13px] font-normal text-ink hover:bg-surface'
              : 'w-full justify-start border border-line bg-surface px-3 text-left text-base font-normal text-ink hover:bg-surface'
          }
          title={label}
          type="button"
          variant="outline"
        >
          <CalendarDays
            aria-hidden="true"
            className="shrink-0 text-stone-600"
            size={16}
          />
          <span className="truncate">{compact ? 'Ngày' : label}</span>
          {(validFrom || validTo) && (
            <span className="text-xs font-bold">(1)</span>
          )}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="ml-auto shrink-0 text-stone-600"
          />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          aria-label="Chọn khoảng ngày"
          className="date-range-popover-content text-xs z-50 max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-auto rounded-md border border-line bg-surface p-3 shadow-overlay"
          collisionPadding={12}
          role="dialog"
          sideOffset={8}
        >
          <Suspense
            fallback={
              <p className="w-64 max-w-full py-10 text-center text-sm text-muted">
                Đang tải lịch...
              </p>
            }
          >
            <Calendar
              numberOfMonths={numberOfMonths}
              selected={selected}
              onSelect={(range) => {
                onChange({
                  dateFrom: range?.from
                    ? formatCalendarDate(range.from)
                    : undefined,
                  dateTo: range?.to ? formatCalendarDate(range.to) : undefined,
                });
              }}
            />
          </Suspense>
          <div className="flex justify-between gap-2 border-t border-line pt-2">
            <Button
              className="px-2 text-sm"
              onClick={() => {
                onChange({ dateFrom: undefined, dateTo: undefined });
                setIsOpen(false);
              }}
              type="button"
              variant="link"
            >
              Xóa ngày
            </Button>
            <Button
              className="px-2 text-sm"
              onClick={() => setIsOpen(false)}
              type="button"
              variant="ghost"
            >
              Đóng
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
