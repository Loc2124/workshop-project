import React from 'react';
import { type UseQueryResult } from '@tanstack/react-query';
import { type CalendarDay, errorMessage } from './financialTypes';

export interface FinancialCalendarTabProps {
  calendar: {
    date: string;
    type: CalendarDay['type'];
    label: string;
    officialReference: string;
  };
  setCalendar: React.Dispatch<
    React.SetStateAction<{
      date: string;
      type: CalendarDay['type'];
      label: string;
      officialReference: string;
    }>
  >;
  days: UseQueryResult<CalendarDay[], unknown>;
  onSaveDay: () => void;
  isSaving: boolean;
  onDisableDay: (date: string) => void;
  isDisabling: boolean;
}

export function FinancialCalendarTab({
  calendar,
  setCalendar,
  days,
  onSaveDay,
  isSaving,
  onDisableDay,
  isDisabling,
}: FinancialCalendarTabProps) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSaveDay();
        }}
        className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <h2 className="font-heading text-xl font-semibold">
          Thêm lịch theo thông báo nhà nước
        </h2>
        <label className="block text-sm font-medium">
          Ngày
          <input
            required
            type="date"
            value={calendar.date}
            onChange={(e) =>
              setCalendar((x) => ({ ...x, date: e.target.value }))
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Loại ngày
          <select
            value={calendar.type}
            onChange={(e) =>
              setCalendar((x) => ({
                ...x,
                type: e.target.value as CalendarDay['type'],
              }))
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          >
            <option value="non_working">Ngày nghỉ/nghỉ bù</option>
            <option value="working">Ngày đi làm bù</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Tên ngày
          <input
            required
            minLength={2}
            value={calendar.label}
            onChange={(e) =>
              setCalendar((x) => ({ ...x, label: e.target.value }))
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
            placeholder="Ví dụ: Nghỉ Tết Âm lịch"
          />
        </label>
        <label className="block text-sm font-medium">
          Căn cứ/văn bản chính thức
          <input
            required
            minLength={4}
            value={calendar.officialReference}
            onChange={(e) =>
              setCalendar((x) => ({
                ...x,
                officialReference: e.target.value,
              }))
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
            placeholder="Số thông báo hoặc liên kết nguồn chính thức"
          />
        </label>
        <button
          disabled={isSaving}
          className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {isSaving ? 'Đang lưu…' : 'Lưu ngày'}
        </button>
      </form>
      <div className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          Các ngày đã khai báo
        </h2>
        {days.isLoading ? (
          <p>Đang tải lịch…</p>
        ) : days.isError ? (
          <p role="alert" className="text-brick">
            {errorMessage(days.error)}
          </p>
        ) : (
          days.data
            ?.filter((d) => d.active)
            .map((d) => (
              <article
                key={d.date}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"
              >
                <div>
                  <p className="font-semibold">
                    {d.date.split('-').reverse().join('/')} · {d.label}
                  </p>
                  <p className="text-sm text-stone-600">
                    {d.type === 'working' ? 'Ngày làm bù' : 'Ngày nghỉ'} ·{' '}
                    {d.officialReference}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDisableDay(d.date)}
                  disabled={isDisabling}
                  className="min-h-10 rounded-lg border border-stone-300 px-3 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
                >
                  Ngừng áp dụng
                </button>
              </article>
            ))
        )}
        {!days.data?.some((d) => d.active) && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
            Chưa khai báo ngày ngoại lệ cho lịch nhà nước.
          </p>
        )}
      </div>
    </section>
  );
}
