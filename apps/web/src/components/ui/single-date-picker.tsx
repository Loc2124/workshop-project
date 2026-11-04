import { LoadingState } from './LoadingState';
import * as Popover from '@radix-ui/react-popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { getBusinessToday, parseCalendarDate } from '../../lib/calendar-date';
import { Button } from './button';

const Calendar = lazy(async () => ({
  default: (await import('react-day-picker')).DayPicker,
}));

export function SingleDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseCalendarDate(value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-surface text-base font-normal text-ink"
          aria-label="Ngày trải nghiệm"
          type="button"
        >
          <span>
            {selected
              ? format(selected, 'dd/MM/yyyy', { locale: vi })
              : 'Chọn ngày'}
          </span>
          <CalendarDays size={18} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          aria-label="Chọn ngày trải nghiệm"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] overflow-auto rounded-2xl bg-surface p-3 shadow-overlay"
        >
          <Suspense
            fallback={
              <LoadingState label="Đang tải lịch…" className="p-6 text-base" />
            }
          >
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              locale={vi}
              weekStartsOn={1}
              disabled={{ before: getBusinessToday() }}
              autoFocus
              onSelect={(date) => {
                onChange(date ? format(date, 'yyyy-MM-dd') : '');
                setOpen(false);
              }}
            />
          </Suspense>
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Xóa ngày
            </Button>
            <Popover.Close asChild>
              <Button type="button" variant="ghost">
                Đóng
              </Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
