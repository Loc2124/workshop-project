import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { geographyQueries } from './geography-queries';
import { catalogService } from '../../services/catalogService';
import { invalidatePublicCatalog } from '../api/query-invalidation';

afterEach(() => vi.restoreAllMocks());

it('reuses available provinces but keeps registration and province-specific areas separate', async () => {
  const client = new QueryClient();
  const provinces = vi
    .spyOn(catalogService, 'provinces')
    .mockImplementation(async (_signal, all) => ({
      provinces: [
        { id: all ? 'all' : 'available', name: 'Tỉnh', studioCount: 1 },
      ],
    }));
  const areas = vi
    .spyOn(catalogService, 'areas')
    .mockImplementation(async (provinceId) => ({
      areas: [{ id: provinceId, name: 'Khu vực', studioCount: 1 }],
    }));
  try {
    await Promise.all([
      client.fetchQuery(geographyQueries.provinces()),
      client.fetchQuery(geographyQueries.provinces()),
    ]);
    await client.fetchQuery(geographyQueries.provinces());
    expect(provinces).toHaveBeenCalledTimes(1);
    expect(
      (await client.fetchQuery(geographyQueries.provinces(true))).provinces[0]
        .id,
    ).toBe('all');
    await client.fetchQuery(geographyQueries.areas('a'));
    await client.fetchQuery(geographyQueries.areas('b'));
    await client.fetchQuery(geographyQueries.areas('a'));
    expect(areas).toHaveBeenCalledTimes(2);
    await invalidatePublicCatalog(client);
    await client.fetchQuery(geographyQueries.provinces());
    await client.fetchQuery(geographyQueries.areas('a'));
    expect(provinces).toHaveBeenCalledTimes(3);
    expect(areas).toHaveBeenCalledTimes(3);
  } finally {
    client.clear();
  }
});
