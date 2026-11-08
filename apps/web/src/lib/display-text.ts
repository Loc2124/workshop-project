export function bookingDisplayText(value: string, fallback: string) {
  return import.meta.env.PROD && /^test\d*$/i.test(value.trim())
    ? fallback
    : value;
}
