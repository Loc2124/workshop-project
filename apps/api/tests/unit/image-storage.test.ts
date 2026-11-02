import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSignedUploadUrl,
  inspectUploadedImage,
  removeStorageImages,
} from '../../src/modules/images/image-storage.js';

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://storage.example.test');
  vi.stubEnv('SUPABASE_SECRET_KEY', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'backend-only-test-service-key');
  vi.stubEnv('STUDIO_IMAGE_BUCKET', 'studio-images');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('studio image storage boundary', () => {
  it('supports a new secret key when no service_role key is configured', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_backend_only_test_key');
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        url: '/object/upload/sign/studio-images/photo.webp?token=scoped',
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const url = await createSignedUploadUrl('photo.webp');
    expect(fetch.mock.calls[0][1].headers.apikey).toBe(
      'sb_secret_backend_only_test_key',
    );
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('authorization');
    expect(url).not.toContain('sb_secret_');
  });
  it('prefers the configured service_role key when both key types are present', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_backend_only_test_key');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          url: '/object/upload/sign/studio-images/photo.webp?token=scoped',
        }),
      );
    vi.stubGlobal('fetch', fetch);
    await createSignedUploadUrl('photo.webp');
    expect(fetch.mock.calls[0][1].headers.apikey).toBe(
      'backend-only-test-service-key',
    );
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer backend-only-test-service-key',
    );
  });
  it('returns only an object-scoped signed upload URL, never the service key', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        url: '/object/upload/sign/studio-images/studios/id/profile/photo.webp?token=object-only',
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const url = await createSignedUploadUrl('studios/id/profile/photo.webp');
    expect(url).toBe(
      'https://storage.example.test/storage/v1/object/upload/sign/studio-images/studios/id/profile/photo.webp?token=object-only',
    );
    expect(url).not.toContain('backend-only-test-service-key');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer backend-only-test-service-key',
    );
    expect(fetch.mock.calls[0][1].headers['x-upsert']).toBe('false');
  });
  it('refuses invalid images even when their MIME claims WebP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not an image', {
          headers: { 'Content-Type': 'image/webp' },
        }),
      ),
    );
    await expect(
      inspectUploadedImage('studios/id/profile/photo.webp', 12),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
  it('checks the actual file dimensions and bytes before confirmation', async () => {
    const bytes = Buffer.alloc(30);
    bytes.write('RIFF');
    bytes.writeUInt32LE(22, 4);
    bytes.write('WEBP', 8);
    bytes.write('VP8X', 12);
    bytes.writeUInt32LE(10, 16);
    bytes.writeUIntLE(1599, 24, 3);
    bytes.writeUIntLE(899, 27, 3);
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(new Uint8Array(bytes), {
          headers: { 'Content-Type': 'image/webp' },
        }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(inspectUploadedImage('key', 30)).resolves.toBeUndefined();
    bytes.writeUIntLE(1600, 24, 3);
    await expect(inspectUploadedImage('key', 30)).rejects.toMatchObject({
      statusCode: 422,
    });
    await expect(inspectUploadedImage('key', 29)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
  it('removes the exact stored key and surfaces failed deletion for retry', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    await removeStorageImages(['studios/id/profile/photo.webp']);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ prefixes: ['studios/id/profile/photo.webp'] }),
    });
    await expect(removeStorageImages(['key'])).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
