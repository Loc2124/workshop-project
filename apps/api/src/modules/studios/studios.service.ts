import type { StudioEvidenceInput } from '@workshop/shared';
import {
  createStudioDraft,
  deleteStudioDraft,
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
  const studios = await listMemberStudios(userId);
  return {
    studios: await withStudiosImages(studios),
  };
}

export async function withStudioImages<
  T extends { photoIds?: string[]; paymentQrImageId?: string | null },
>(studio: T) {
  return (await withStudiosImages([studio]))[0]!;
}

export async function withStudiosImages<
  T extends { photoIds?: string[]; paymentQrImageId?: string | null },
>(studios: T[]) {
  const ids = [
    ...new Set(
      studios.flatMap((studio) => [
        ...(studio.photoIds ?? []),
        ...(studio.paymentQrImageId ? [studio.paymentQrImageId] : []),
      ]),
    ),
  ];
  const imageRows = ids.length > 0 ? await getImageUrlsForIds(ids) : [];
  const imagesById = new Map(imageRows.map((image) => [image.id, image]));

  return studios.map((studio) => {
    const images = (studio.photoIds ?? [])
      .map((id) => imagesById.get(id))
      .filter((image) => image !== undefined);
    const qr = studio.paymentQrImageId
      ? imagesById.get(studio.paymentQrImageId)
      : undefined;

    return {
      ...studio,
      images: images.map(presentImage),
      paymentQrImageUrl: qr ? presentImage(qr).url : null,
    };
  });
}
export async function startStudioDraft(userId: string) {
  return { studio: await createStudioDraft(userId) };
}
export async function discardStudioDraft(studioId: string, userId: string) {
  const deleted = await deleteStudioDraft(studioId, userId);
  if (!deleted) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy hồ sơ nháp hoặc bạn không có quyền hủy.',
    );
  }
  return { deleted: true, studioId };
}
export async function submitStudioEvidence(
  studioId: string,
  userId: string,
  input: StudioEvidenceInput,
) {
  return updateStudioEvidence(studioId, userId, input);
}
