import type { StudioEvidenceInput } from '@workshop/shared';
import {
  createStudioDraft,
  updateStudioEvidence,
} from './studios.repository.js';
import { getImageUrlsForIds } from '../images/images.repository.js';
import { imagePublicUrl } from '../images/image-storage.js';
import { AppError } from '../../errors/app-error.js';
import { assertCategoryId } from '../catalog/categories.repository.js';
import { createStudio, listMemberStudios } from './studios.repository.js';
import type { StudioProfileInput } from './studios.schemas.js';

export async function registerStudio(
  userId: string,
  input: StudioProfileInput,
) {
  const categoryIds = input.categoryIds ?? [input.categoryId];
  for (const categoryId of categoryIds) await assertCategoryId(categoryId);
  const studio = await createStudio(userId, input);
  if (!studio) {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Tỉnh/thành hoặc khu vực không hợp lệ.',
    );
  }

  return { studio: await withStudioImages(studio) };
}

export async function listStudiosForUser(userId: string) {
  return {
    studios: await Promise.all(
      (await listMemberStudios(userId)).map(withStudioImages),
    ),
  };
}

export async function withStudioImages<T extends { photoIds?: string[] }>(
  studio: T,
) {
  const images = await getImageUrlsForIds(studio.photoIds ?? []);
  return {
    ...studio,
    images: images.map((image) => ({
      ...image,
      url: imagePublicUrl(image.key),
    })),
  };
}
export async function startStudioDraft(userId: string) {
  return { studio: await createStudioDraft(userId) };
}
export async function submitStudioEvidence(
  studioId: string,
  userId: string,
  input: StudioEvidenceInput,
) {
  return updateStudioEvidence(studioId, userId, input);
}
