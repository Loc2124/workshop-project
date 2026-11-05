import { describe, expect, it } from 'vitest';
import { parseExploreUrl } from './explore-url';

describe('parseExploreUrl', () => {
  it('preserves slug province IDs while province options are loading', () => {
    const initial = new URLSearchParams('view=workshop&province_id=ha-noi');
    const pending = parseExploreUrl(initial, []);
    expect(pending.filters.provinceId).toBe('ha-noi');
    expect(pending.normalizedParams.get('province_id')).toBe('ha-noi');

    const loaded = parseExploreUrl(initial, [
      { id: 'ha-noi', name: 'Hà Nội', studioCount: 3 },
    ]);
    expect(loaded.filters.provinceId).toBe('ha-noi');
  });

  it('drops invalid dates, reversed ranges, unsafe prices, pages, enums, and area IDs', () => {
    const parsed = parseExploreUrl(
      new URLSearchParams(
        'date_from=2025-02-30&date_to=2025-03-01&price_min=-1&price_max=2147483648&page=2147483648&level=expert&area_ids=bad&sort=unknown&view=bad',
      ),
    );

    expect(parsed.filters).toMatchObject({
      page: 1,
      pageSize: 12,
    });
    expect(parsed.filters.dateFrom).toBeUndefined();
    expect(parsed.filters.dateTo).toBe('2025-03-01');
    expect(parsed.filters.priceMin).toBeUndefined();
    expect(parsed.filters.priceMax).toBeUndefined();
    expect(parsed.filters.areaIds).toBeUndefined();
    expect(parsed.filters.level).toBeUndefined();
    expect(parsed.sort).toBe('recommended');
    expect(parsed.view).toBe('workshops');
    expect(parsed.normalizedParams.has('date_from')).toBe(false);
    expect(parsed.normalizedParams.has('sort')).toBe(false);
    expect(parsed.normalizedParams.has('view')).toBe(false);
  });

  it('drops inverted date and price ranges rather than applying contradictory filters', () => {
    const parsed = parseExploreUrl(
      new URLSearchParams(
        'date_from=2025-06-02&date_to=2025-06-01&price_min=900&price_max=100',
      ),
    );

    expect(parsed.filters.dateFrom).toBeUndefined();
    expect(parsed.filters.dateTo).toBeUndefined();
    expect(parsed.filters.priceMin).toBeUndefined();
    expect(parsed.filters.priceMax).toBeUndefined();
    expect(parsed.normalizedParams.has('date_from')).toBe(false);
    expect(parsed.normalizedParams.has('price_min')).toBe(false);
  });

  it('round-trips valid filters while retaining unrelated query parameters', () => {
    const parsed = parseExploreUrl(
      new URLSearchParams(
        'date=2025-02-28&price_min=0&price_max=2147483647&page=2&level=beginner&sort=soonest&view=studio&area_ids=550e8400-e29b-41d4-a716-446655440000&q=gom',
      ),
    );

    expect(parsed.filters).toMatchObject({
      page: 2,
      dateFrom: '2025-02-28',
      dateTo: '2025-02-28',
      priceMin: 0,
      priceMax: 2_147_483_647,
      level: 'beginner',
      areaIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(parsed.sort).toBe('soonest');
    expect(parsed.view).toBe('studios');
    expect(parsed.query).toBe('gom');
    expect(parsed.normalizedParams.get('q')).toBe('gom');
  });

  it('retains unknown categories until the dynamic category list has loaded', () => {
    const parsed = parseExploreUrl(
      new URLSearchParams('type=dynamic-category'),
      [],
      false,
    );

    expect(parsed.filters.categoryId).toBeUndefined();
    expect(parsed.normalizedParams.get('type')).toBe('dynamic-category');
  });
});
