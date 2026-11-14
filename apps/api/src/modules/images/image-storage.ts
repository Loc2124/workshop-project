import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';

export function imageStorageConfig() {
  const parsed = z
    .object({
      SUPABASE_URL: z
        .string()
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            (url.pathname === '/' || url.pathname === '')
          );
        }),
      SUPABASE_SECRET_KEY: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().min(20).startsWith('sb_secret_').optional(),
      ),
      SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().min(20).optional(),
      ),
      STUDIO_IMAGE_BUCKET: z.literal('studio-images').default('studio-images'),
    })
    .refine((config) =>
      Boolean(config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY),
    )
    .transform((config) => ({
      ...config,
      storageKey: (config.SUPABASE_SERVICE_ROLE_KEY ||
        config.SUPABASE_SECRET_KEY)!,
    }))
    .safeParse(process.env);
  if (!parsed.success)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Tính năng tải ảnh chưa sẵn sàng. Vui lòng thử lại sau.',
    );
  return parsed.data;
}

export function imagePublicUrl(key: string): string {
  if (key.startsWith('/') || key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  const { SUPABASE_URL, STUDIO_IMAGE_BUCKET } = imageStorageConfig();
  return new URL(
    `/storage/v1/object/public/${STUDIO_IMAGE_BUCKET}/${key}`,
    SUPABASE_URL,
  ).href;
}

export async function storageRequest(path: string, init: RequestInit = {}) {
  const config = imageStorageConfig();
  const headers: Record<string, string> = {
    ...Object.fromEntries(new Headers(init.headers)),
    apikey: config.storageKey,
  };
  // New secret keys are not JWTs; send them only through apikey.
  delete headers.authorization;
  if (!config.storageKey.startsWith('sb_secret_'))
    headers.Authorization = `Bearer ${config.storageKey}`;
  try {
    return await fetch(new URL(`/storage/v1/${path}`, config.SUPABASE_URL), {
      ...init,
      headers,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa kết nối được dịch vụ ảnh. Vui lòng thử lại.',
    );
  }
}

export async function createSignedUploadUrl(key: string, bucket?: string) {
  const config = imageStorageConfig();
  const response = await storageRequest(
    `object/upload/sign/${bucket ?? config.STUDIO_IMAGE_BUCKET}/${key}`,
    { method: 'POST', headers: { 'x-upsert': 'false' } },
  );
  if (!response.ok)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa cấp được quyền tải ảnh. Vui lòng thử lại.',
    );
  const data = z.object({ url: z.string() }).parse(await response.json());
  const url = new URL(`/storage/v1${data.url}`, config.SUPABASE_URL);
  // Never return a service key; this URL contains only a token scoped to one new object.
  return url.href;
}

export async function inspectUploadedImage(
  key: string,
  expectedSize: number,
  bucket?: string,
  maxBytes = 1024 * 1024,
) {
  const config = imageStorageConfig();
  const response = await storageRequest(
    `object/${bucket ?? config.STUDIO_IMAGE_BUCKET}/${key}`,
  );
  if (
    !response.ok ||
    response.headers.get('content-type')?.split(';')[0] !== 'image/webp'
  )
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Ảnh chưa tải xong hoặc không đúng định dạng WebP.',
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Ảnh không hợp lệ.');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        `Ảnh không được quá ${maxBytes / (1024 * 1024)} MB.`,
      );
    }
    parts.push(value);
  }
  const bytes = Buffer.concat(parts);
  if (
    size !== expectedSize ||
    size < 30 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  )
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Nội dung ảnh không hợp lệ.',
    );
  const chunk = bytes.toString('ascii', 12, 16);
  let width = 0,
    height = 0;
  if (chunk === 'VP8X') {
    width = 1 + bytes.readUIntLE(24, 3);
    height = 1 + bytes.readUIntLE(27, 3);
  }
  if (
    chunk === 'VP8 ' &&
    bytes.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))
  ) {
    width = bytes.readUInt16LE(26) & 0x3fff;
    height = bytes.readUInt16LE(28) & 0x3fff;
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  }
  if (!width || !height || Math.max(width, height) > 1600)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Ảnh cần có cạnh dài tối đa 1600px.',
    );
}

export async function removeStorageImages(keys: string[], bucket?: string) {
  if (!keys.length) return;
  const config = imageStorageConfig();
  const response = await storageRequest(
    `object/${bucket ?? config.STUDIO_IMAGE_BUCKET}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: keys }),
    },
  );
  if (!response.ok)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa xóa được ảnh. Vui lòng thử lại.',
    );
}
