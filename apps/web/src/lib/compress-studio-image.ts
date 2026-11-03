import { defaultSiteSettings } from '@workshop/shared';
export async function compressStudioImage(
  file: File,
  maxMb = defaultSiteSettings.studio.maxImageMb,
  maxSide = 1600,
  outputLimit = maxMb * 1024 * 1024,
): Promise<Blob> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > maxMb * 1024 * 1024
  )
    throw new Error(
      `Chọn ảnh JPG, PNG hoặc WebP, tối đa ${maxMb} MB trước khi nén.`,
    );
  const [{ default: compress }, { default: workerUrl }] = await Promise.all([
    import('browser-image-compression'),
    import('browser-image-compression/dist/browser-image-compression.js?url'),
  ]);
  const blob = await compress(file, {
    maxSizeMB: Math.min(outputLimit, 1024 * 1024) / (1024 * 1024),
    maxWidthOrHeight: maxSide,
    fileType: 'image/webp',
    initialQuality: 0.82,
    useWebWorker: true,
    libURL: workerUrl,
    maxIteration: 8,
  });
  if (blob.type !== 'image/webp' || blob.size > outputLimit)
    throw new Error(
      `Chưa nén được ảnh dưới ${maxMb} MB. Chọn ảnh nhỏ hơn để thử lại.`,
    );
  return blob;
}
