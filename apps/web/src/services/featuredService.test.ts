import { describe, expect, it, vi } from 'vitest';
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('../lib/api-client', () => ({ apiFetch }));
import { getPublicFeatured } from './featuredService';
describe('homepage API content', () => {
  it('keeps an empty API response empty instead of inserting simulated records', async () => {
    apiFetch.mockResolvedValue({ studios: [], workshops: [] });
    const signal = new AbortController().signal;
    expect(await getPublicFeatured(signal)).toEqual({
      studios: [],
      workshops: [],
    });
    expect(apiFetch).toHaveBeenCalledWith('/home/featured', { signal });
  });
  it('propagates API failure without replacing it with mock data', async () => {
    apiFetch.mockRejectedValue(new Error('Unavailable'));
    await expect(
      getPublicFeatured(new AbortController().signal),
    ).rejects.toThrow('Unavailable');
  });
});
