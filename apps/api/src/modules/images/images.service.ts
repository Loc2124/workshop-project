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

export function presentImage(image: {
  id: string;
  key: string;
  thumbnailKey?: string | null;
  mediumKey?: string | null;
}) {
  return {
    id: image.id,
    key: image.key,
    url: imagePublicUrl(image.key),
    ...(image.mediumKey ? { mediumUrl: imagePublicUrl(image.mediumKey) } : {}),
    ...(image.thumbnailKey
      ? { thumbnailUrl: imagePublicUrl(image.thumbnailKey) }
      : {}),
  };
}
const storageKeys = (image: {
  key: string;
  thumbnailKey?: string | null;
  mediumKey?: string | null;
}) =>
  [image.key, image.thumbnailKey, image.mediumKey].filter(
    (key): key is string => !!key,
  );

export async function listOwnedImages(
  studioId: string,
  userId: string,
  workshopId?: string | null,
) {
  await assertImageOwner(studioId, userId, workshopId);
  return {
    images: (await listStudioImages(studioId, workshopId)).map(presentImage),
  };
}

export async function requestImageUpload(
  userId: string,
  input: {
    studioId: string;
    workshopId?: string | null;
    byteSize: number;
    thumbnailByteSize?: number;
    mediumByteSize?: number;
  },
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
  const thumbnailKey = input.thumbnailByteSize
    ? key.replace(/\.webp$/, '.thumb.webp')
    : null;
  const mediumKey = input.mediumByteSize
    ? key.replace(/\.webp$/, '.medium.webp')
    : null;
  await reserveImage(
    id,
    input.studioId,
    input.workshopId ?? null,
    userId,
    key,
    input.byteSize,
    thumbnailKey,
    input.thumbnailByteSize ?? null,
    mediumKey,
    input.mediumByteSize ?? null,
  );
  const [signedUploadUrl, thumbnailSignedUploadUrl, mediumSignedUploadUrl] =
    await Promise.all([
      createSignedUploadUrl(key),
      thumbnailKey ? createSignedUploadUrl(thumbnailKey) : undefined,
      mediumKey ? createSignedUploadUrl(mediumKey) : undefined,
    ]);
  return {
    id,
    key,
    signedUploadUrl,
    ...(mediumSignedUploadUrl ? { mediumSignedUploadUrl } : {}),
    ...(thumbnailSignedUploadUrl ? { thumbnailSignedUploadUrl } : {}),
  };
}
export async function finishImageUpload(id: string, userId: string) {
  const image = await getOwnedImage(id, userId);
  if (image.state === 'ready')
    return {
      image: presentImage(image),
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
  if (image.thumbnailKey && image.thumbnailByteSize)
    await inspectUploadedImage(
      image.thumbnailKey,
      image.thumbnailByteSize,
      undefined,
      200 * 1024,
    );
  if (image.mediumKey && image.mediumByteSize)
    await inspectUploadedImage(
      image.mediumKey,
      image.mediumByteSize,
      undefined,
      600 * 1024,
    );
  await confirmImage(id);
  return { image: presentImage(image) };
}
export async function deleteOwnedImage(id: string, userId: string) {
  const image = await getOwnedImage(id, userId);
  if (image.state === 'deleted') return;
  await markImageDeleting(id);
  await removeStorageImages(storageKeys(image));
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
    await removeStorageImages(storageKeys(image));
    await markImageDeleted(image.id);
    await purgeExpiredImage(image.id);
    count++;
  }
  return count;
}
