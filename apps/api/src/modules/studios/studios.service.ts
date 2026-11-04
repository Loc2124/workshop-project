import type { StudioEvidenceInput } from '@workshop/shared';
import {
  createStudioDraft,
  updateStudioEvidence,
} from './studios.repository.js';
import { getImageUrlsForIds } from '../images/images.repository.js';
import { presentImage } from '../images/images.service.js';
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

export async function withStudioImages<
  T extends { photoIds?: string[]; paymentQrImageId?: string | null },
>(studio: T) {
  const images = await getImageUrlsForIds(studio.photoIds ?? []);
  const qr = await getImageUrlsForIds(
    studio.paymentQrImageId ? [studio.paymentQrImageId] : [],
  );
  return {
    ...studio,
    images: images.map(presentImage),
    paymentQrImageUrl: qr[0] ? presentImage(qr[0]).url : null,
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
