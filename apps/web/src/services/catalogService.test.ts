import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogService } from './catalogService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('catalogService provinces', () => {
  it('can request the full province directory without changing public filtering', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        provinces: [{ id: 'an-giang', name: 'An Giang', studioCount: 0 }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await catalogService.provinces(undefined, true);

    expect(
      new URL(String(fetchMock.mock.calls[0][0])).searchParams.get(
        'include_empty',
      ),
    ).toBe('true');
  });
});
