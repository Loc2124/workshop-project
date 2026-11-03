import { z } from 'zod';
import { fetchSiteSettings } from '../hooks/useSiteSettings';
import { apiFetch } from '../lib/api-client';

export const uploadedImageSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    mediumUrl: z.string().url().optional(),
  })
  .strict();
export type UploadedImage = z.infer<typeof uploadedImageSchema>;
export async function uploadToSignedUrl(
  signedUploadUrl: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
  cacheControl = '31536000',
) {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', signedUploadUrl);
    request.withCredentials = false;
    request.timeout = 60000;
    request.setRequestHeader('Content-Type', 'image/webp');
    request.setRequestHeader('cache-control', `max-age=${cacheControl}`);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error('Chưa tải được ảnh. Vui lòng thử lại.'));
    request.onerror = () =>
      reject(new Error('Mất kết nối khi tải ảnh. Vui lòng thử lại.'));
    request.ontimeout = () =>
      reject(new Error('Tải ảnh quá lâu. Vui lòng thử lại.'));
    request.onabort = () => reject(new Error('Đã dừng tải ảnh.'));
    request.send(blob);
  });
}
export const imageService = {
  async startDraft() {
    return z
      .object({ studio: z.object({ id: z.string().uuid() }) })
      .parse(await apiFetch('/studios/drafts', { method: 'POST' })).studio.id;
  },
  async list(studioId: string, signal?: AbortSignal): Promise<UploadedImage[]> {
    return z.object({ images: z.array(uploadedImageSchema) }).parse(
      await apiFetch(`/images?studioId=${encodeURIComponent(studioId)}`, {
        signal,
      }),
    ).images;
  },
  async upload(
    studioId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadedImage> {
    onProgress?.(0);
    const maxMb = (await fetchSiteSettings()).studio.maxImageMb;
    const { compressStudioImage } =
      await import('../lib/compress-studio-image');
    const blob = await compressStudioImage(file, maxMb);
    const medium = await compressStudioImage(
      new File([blob], 'medium.webp', { type: 'image/webp' }),
      maxMb,
      960,
      600 * 1024,
    );
    // Generate locally: no paid image transformation or service key in the browser.
    const thumbnail = await compressStudioImage(
      new File([blob], 'thumbnail.webp', { type: 'image/webp' }),
      maxMb,
      480,
      200 * 1024,
    );
    const upload = z
      .object({
        id: z.string().uuid(),
        key: z.string(),
        signedUploadUrl: z.string().url(),
        thumbnailSignedUploadUrl: z.string().url(),
        mediumSignedUploadUrl: z.string().url(),
      })
      .parse(
        await apiFetch('/images/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            studioId,
            byteSize: blob.size,
            thumbnailByteSize: thumbnail.size,
            mediumByteSize: medium.size,
          }),
        }),
      );
    await uploadToSignedUrl(upload.signedUploadUrl, blob, (percent) =>
      onProgress?.(Math.min(65, Math.round(percent * 0.65))),
    );
    await uploadToSignedUrl(upload.mediumSignedUploadUrl, medium, (p) =>
      onProgress?.(65 + Math.round(p * 0.2)),
    );
    await uploadToSignedUrl(
      upload.thumbnailSignedUploadUrl,
      thumbnail,
      (percent) => onProgress?.(85 + Math.round(percent * 0.1)),
    );
    const image = z
      .object({ image: uploadedImageSchema })
      .parse(
        await apiFetch(`/images/${upload.id}/complete`, { method: 'POST' }),
      ).image;
    onProgress?.(100);
    return image;
  },
  async remove(id: string) {
    await apiFetch(`/images/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      responseType: 'void',
    });
  },
};
