const vietnamOffsetMilliseconds = 7 * 60 * 60 * 1000;

export function toVietnamDateTimeLocal(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + vietnamOffsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

export function fromVietnamDateTimeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  return `${value}:00+07:00`;
}
