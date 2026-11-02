import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPasswordNotCompromised } from '../../src/modules/auth/password-check.js';

afterEach(() => vi.unstubAllGlobals());
const password = 'WillowFern72!';
const hash = createHash('sha1').update(password).digest('hex').toUpperCase();

describe('compromised password check', () => {
  it('sends only a padded hash prefix and rejects a matching compromised suffix', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(`${hash.slice(5)}:12\r\n${'A'.repeat(35)}:0`),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(assertPasswordNotCompromised(password)).rejects.toMatchObject({
      statusCode: 422,
      code: 'PASSWORD_COMPROMISED',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Add-Padding': 'true' }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(password);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(hash);
  });
  it('ignores padding entries with zero occurrences', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(`${hash.slice(5)}:0`)),
    );
    await expect(
      assertPasswordNotCompromised(password),
    ).resolves.toBeUndefined();
  });
  it('accepts a password absent from the returned range', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(`${'A'.repeat(35)}:42`)),
    );
    await expect(
      assertPasswordNotCompromised(password),
    ).resolves.toBeUndefined();
  });
  it.each([
    new Response('unavailable', { status: 503 }),
    new Response(''),
    new Response('<html>bad response</html>'),
  ])('does not bypass checking on upstream failure', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(assertPasswordNotCompromised(password)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
  it('handles network failures without leaking the original exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(password)));
    await expect(assertPasswordNotCompromised(password)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
    await expect(assertPasswordNotCompromised(password)).rejects.not.toThrow(
      password,
    );
  });
});
