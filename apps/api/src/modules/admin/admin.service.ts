import { AppError } from '../../errors/app-error.js';
import type { StudioApprovalStatus } from './admin.schemas.js';
import { listStudiosForAdmin, updateStudioStatus } from './admin.repository.js';

export async function getStudiosForAdmin(status?: StudioApprovalStatus) {
  return { studios: await listStudiosForAdmin(status) };
}

export async function setStudioStatus(
  studioId: string,
  status: StudioApprovalStatus,
) {
  const studio = await updateStudioStatus(studioId, status);
  if (!studio) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy xưởng cần duyệt.');
  }
  return { studio };
}
