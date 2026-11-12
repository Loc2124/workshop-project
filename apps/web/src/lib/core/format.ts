import { getCategoryMeta } from '@/constants/categories';

export function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export type SessionDateParts = {
  day: string;
  month: string;
  weekday: string;
  date: string;
  time: string;
};

export function formatSessionDate(
  value: string,
  options: { parts: true },
): SessionDateParts;
export function formatSessionDate(
  value: string,
  durationMinutes?: number,
): string;
export function formatSessionDate(
  value: string,
  options?: number | { parts: true },
) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const invalidParts = {
      day: '—',
      month: '—',
      weekday: '—',
      date: '—',
      time: '—',
    };
    return typeof options === 'object'
      ? invalidParts
      : `—${options !== undefined ? ` · ${options} phút` : ''}`;
  }
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
  const parts = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const weekdayLabel: Record<string, string> = {
    Mon: 'Thứ 2',
    Tue: 'Thứ 3',
    Wed: 'Thứ 4',
    Thu: 'Thứ 5',
    Fri: 'Thứ 6',
    Sat: 'Thứ 7',
    Sun: 'CN',
  };

  const result: SessionDateParts = {
    day: part('day'),
    month: part('month'),
    weekday: weekdayLabel[weekday] ?? weekday,
    date: `${part('day')}/${part('month')}/${part('year')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
  if (typeof options === 'object') return result;
  return `${result.weekday}, ${result.date} · ${result.time}${options !== undefined ? ` · ${options} phút` : ''}`;
}

export function formatCategoryLabel(value: string) {
  return getCategoryMeta(value).name;
}

export function formatSlot(date: string | Date) {
  if (date instanceof Date && !Number.isFinite(date.getTime())) return '—';
  const parts = formatSessionDate(
    date instanceof Date ? date.toISOString() : date,
    { parts: true },
  );
  return `${parts.weekday.replace('Thứ ', 'T')}, ${parts.date} · ${parts.time}`;
}
