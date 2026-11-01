import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';

type GeocodeResponse = {
  address?: Record<string, string>;
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/^(thanh pho|tp\.?)\s*/, '')
    .replace(/\s+(city|province|municipality)$/, '')
    .trim();
}

function matchProvince(
  address: Record<string, string>,
  provinces: ProvinceOption[],
) {
  const placeNames = [
    address.city,
    address.state,
    address.province,
    address.region,
    address.county,
  ].filter((value): value is string => Boolean(value));

  for (const placeName of placeNames) {
    const normalized = normalize(placeName);
    const province = provinces.find((item) => {
      const candidate = normalize(item.name);
      return (
        candidate === normalized ||
        candidate.includes(normalized) ||
        normalized.includes(candidate)
      );
    });
    if (province) return province.id;
  }
  return undefined;
}

function requestCoordinates(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Trình duyệt không hỗ trợ định vị.'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300_000,
      timeout: 10_000,
    });
  });
}

export async function detectProvinceId(
  provinces: ProvinceOption[],
  signal?: AbortSignal,
): Promise<string | undefined> {
  const position = await requestCoordinates();
  const endpoint =
    import.meta.env.VITE_REVERSE_GEOCODE_URL ||
    'https://nominatim.openstreetmap.org/reverse';
  const url = new URL(endpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(position.coords.latitude));
  url.searchParams.set('lon', String(position.coords.longitude));
  url.searchParams.set('accept-language', 'vi');
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Không xác định được tỉnh/thành từ vị trí hiện tại.');
  }
  const result = (await response.json()) as GeocodeResponse;
  const matched = result.address
    ? matchProvince(result.address, provinces)
    : undefined;
  if (matched) return matched;
  // When the user's province has no studio, compare representative province
  // coordinates. This is proximity by province, not distance to a studio door.
  let nearest: { id: string; distance: number } | undefined;
  for (const province of provinces) {
    signal?.throwIfAborted();
    const point = await getProvincePoint(province.name, endpoint, signal);
    if (!point) continue;
    const radians = Math.PI / 180;
    const lat1 = position.coords.latitude * radians;
    const lat2 = point.lat * radians;
    const dLat = lat2 - lat1;
    const dLon = (point.lon - position.coords.longitude) * radians;
    const distance =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    if (!nearest || distance < nearest.distance)
      nearest = { id: province.id, distance };
  }
  return nearest?.id;
}

const provincePoints = new Map<string, { lat: number; lon: number }>();
let lastSearchAt = 0;
async function getProvincePoint(
  name: string,
  endpoint: string,
  signal?: AbortSignal,
) {
  if (provincePoints.has(name)) return provincePoints.get(name);
  // Keep requests serial and spaced for the public geocoder; cache for this visit.
  const delay = Math.max(0, 1100 - (Date.now() - lastSearchAt));
  if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
  signal?.throwIfAborted();
  lastSearchAt = Date.now();
  const url = new URL(endpoint);
  url.pathname = url.pathname.replace(/reverse\/?$/, 'search');
  url.search = new URLSearchParams({
    q: `${name}, Việt Nam`,
    format: 'jsonv2',
    countrycodes: 'vn',
    limit: '1',
  }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const [place] = (await response.json()) as Array<{
    lat: string;
    lon: string;
  }>;
  if (!place) return undefined;
  const point = { lat: Number(place.lat), lon: Number(place.lon) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon))
    return undefined;
  provincePoints.set(name, point);
  return point;
}
