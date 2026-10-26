export function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}
