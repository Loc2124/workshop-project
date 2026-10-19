const vietnameseDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatDateTime(value: string | Date): string {
  return vietnameseDateTimeFormatter.format(
    value instanceof Date ? value : new Date(value),
  );
}
