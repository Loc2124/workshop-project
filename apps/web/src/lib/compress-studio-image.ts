import { defaultSiteSettings } from '@workshop/shared';
export async function compressStudioImage(
  file: File,
  maxMb = defaultSiteSettings.studio.maxImageMb,
): Promise<Blob> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > maxMb * 1024 * 1024
  )
    throw new Error(
      `Chọn ảnh JPG, PNG hoặc WebP, tối đa ${maxMb} MB trước khi nén.`,
    );
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas
      .getContext('2d')!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let lastBlob: Blob | null = null;
    for (const quality of [0.82, 0.7, 0.58]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      lastBlob = blob;
      if (
        blob?.type === 'image/webp' &&
        blob.size <= Math.min(maxMb, 1) * 1024 * 1024
      )
        return blob;
    }
    if (lastBlob?.type === 'image/webp' && lastBlob.size <= maxMb * 1024 * 1024)
      return lastBlob;
    throw new Error(
      `Chưa nén được ảnh dưới ${maxMb} MB. Chọn ảnh nhỏ hơn để thử lại.`,
    );
  } finally {
    bitmap.close();
  }
}
