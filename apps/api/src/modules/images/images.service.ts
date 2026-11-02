import { randomUUID } from 'node:crypto';
import { getSiteSettings } from '../settings/settings.repository.js';
import { AppError } from '../../errors/app-error.js';
import {
  assertImageOwner,
  reserveImage,
  getOwnedImage,
  confirmImage,
  markImageDeleting,
  markImageDeleted,
  expiredImages,
  purgeExpiredImage,
} from './images.repository.js';
import {
  createSignedUploadUrl,
  imagePublicUrl,
  inspectUploadedImage,
  removeStorageImages,
} from './image-storage.js';
import { listStudioImages } from './images.repository.js';

export async function listOwnedImages(
  studioId: string,
  userId: string,
  workshopId?: string | null,
) {
  await assertImageOwner(studioId, userId, workshopId);
  return {
    images: (await listStudioImages(studioId, workshopId)).map((image) => ({
      ...image,
      url: imagePublicUrl(image.key),
    })),
  };
}

export async function requestImageUpload(
  userId: string,
  input: { studioId: string; workshopId?: string | null; byteSize: number },
) {
  await assertImageOwner(input.studioId, userId, input.workshopId);
  const policy = (await getSiteSettings()).studio;
  if (input.byteSize > policy.maxImageMb * 1024 * 1024)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      `Ảnh không được quá ${policy.maxImageMb} MB.`,
    );
  const id = randomUUID();
  const key = `studios/${input.studioId}/${input.workshopId ?? 'profile'}/${id}.webp`;
  await reserveImage(
    id,
    input.studioId,
    input.workshopId ?? null,
    userId,
    key,
    input.byteSize,
  );
  return { id, key, signedUploadUrl: await createSignedUploadUrl(key) };
}
export async function finishImageUpload(id: string, userId: string) {
  const image = await getOwnedImage(id, userId);
  if (image.state === 'ready')
    return {
      image: { id: image.id, key: image.key, url: imagePublicUrl(image.key) },
    };
  if (image.state !== 'pending' || image.expired)
    throw new AppError(
      409,
      'CONFLICT',
      'Lượt tải ảnh đã hết hạn. Chọn ảnh để tải lại.',
    );
  await inspectUploadedImage(
    image.key,
    image.byteSize,
    undefined,
    (await getSiteSettings()).studio.maxImageMb * 1024 * 1024,
  );
  await confirmImage(id);
  return { image: { id, key: image.key, url: imagePublicUrl(image.key) } };
}
export async function deleteOwnedImage(id: string, userId: string) {
  const image = await getOwnedImage(id, userId);
  if (image.state === 'deleted') return;
  await markImageDeleting(id);
  await removeStorageImages([image.key]);
  await markImageDeleted(id);
}
export async function cleanupImages() {
  const expired = await expiredImages();
  let count = 0;
  for (const image of expired) {
    if (image.state !== 'deleted') {
      try {
        await markImageDeleting(image.id);
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) continue;
        throw error;
      }
    }
    await removeStorageImages([image.key]);
    await markImageDeleted(image.id);
    await purgeExpiredImage(image.id);
    count++;
  }
  return count;
}
