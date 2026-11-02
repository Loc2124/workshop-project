import { AppError } from '../../errors/app-error.js';
import { assertCategoryId } from '../catalog/categories.repository.js';
import {
  createWorkshop as insertWorkshop,
  listWorkshops as selectWorkshops,
  updateWorkshop as saveWorkshop,
} from './workshops.repository.js';
import type {
  WorkshopInput,
  WorkshopUpdateInput,
} from './workshops.schemas.js';
import { getStudioMemberRole } from '../studios/studios.repository.js';

export async function getStudioWorkshops(studioId: string, userId: string) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  return { workshops: (await selectWorkshops(studioId, userId)) ?? [] };
}

export async function createStudioWorkshop(
  studioId: string,
  userId: string,
  input: WorkshopInput,
) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  if (role !== 'owner') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được tạo workshop và thiết lập giá cơ sở.',
    );
  }

  await assertCategoryId(input.categoryId);
  const workshop = await insertWorkshop(studioId, userId, input);

  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }

  return { workshop };
}

export async function updateStudioWorkshop(
  studioId: string,
  userId: string,
  workshopId: string,
  input: WorkshopUpdateInput,
) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  if (
    (Object.hasOwn(input, 'basePrice') ||
      Object.hasOwn(input, 'depositPercent')) &&
    role !== 'owner'
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được thay đổi giá workshop.',
    );
  }

  if (input.categoryId !== undefined)
    await assertCategoryId(input.categoryId, workshopId);
  const workshop = await saveWorkshop(studioId, userId, workshopId, input);

  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }

  return { workshop };
}
