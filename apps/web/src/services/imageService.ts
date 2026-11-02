import { z } from 'zod';
import { fetchSiteSettings } from '../hooks/useSiteSettings';
import { apiFetch } from '../lib/api-client';
import { compressStudioImage } from '../lib/compress-studio-image';

export const uploadedImageSchema = z
  .object({ id: z.string().uuid(), key: z.string(), url: z.string().url() })
  .strict();
export type UploadedImage = z.infer<typeof uploadedImageSchema>;
export async function uploadToSignedUrl(
  signedUploadUrl: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', signedUploadUrl);
    request.withCredentials = false;
    request.timeout = 60000;
    request.setRequestHeader('Content-Type', 'image/webp');
    request.setRequestHeader('cache-control', '3600');
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
    const blob = await compressStudioImage(
      file,
      (await fetchSiteSettings()).studio.maxImageMb,
    );
    const upload = z
      .object({
        id: z.string().uuid(),
        key: z.string(),
        signedUploadUrl: z.string().url(),
      })
      .parse(
        await apiFetch('/images/upload-url', {
          method: 'POST',
          body: JSON.stringify({ studioId, byteSize: blob.size }),
        }),
      );
    await uploadToSignedUrl(upload.signedUploadUrl, blob, (percent) =>
      onProgress?.(Math.min(95, Math.round(percent * 0.95))),
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
