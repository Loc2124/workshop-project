import { AppError } from '../../errors/app-error.js';
import { assertCategoryId } from '../catalog/categories.repository.js';
import { createStudio } from './studios.repository.js';
import type { StudioProfileInput } from './studios.schemas.js';

export async function registerStudio(
  userId: string,
  input: StudioProfileInput,
) {
  await assertCategoryId(input.categoryId);
  const studio = await createStudio(userId, input);
  if (!studio) {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Tỉnh/thành hoặc khu vực không hợp lệ.',
    );
  }

  return { studio };
}
