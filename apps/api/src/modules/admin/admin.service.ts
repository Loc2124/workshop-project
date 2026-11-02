import { withStudioImages } from '../studios/studios.service.js';
import { selectAdminOverview } from './admin-overview.repository.js';
import { selectAdminRecords } from './admin-records.repository.js';
export async function getAdminOverview() {
  return selectAdminOverview();
}
export async function getAdminRecords(
  kind: import('./admin.schemas.js').AdminRecordKind,
  filters: import('./admin.schemas.js').AdminRecordQuery,
) {
  return selectAdminRecords(kind, filters);
}
import { AppError } from '../../errors/app-error.js';
import type { StudioVerificationDecision } from '@workshop/shared';
import { updateStudioVerification } from './admin.repository.js';

export async function setStudioVerification(
  studioId: string,
  reviewerId: string,
  decision: StudioVerificationDecision,
) {
  return {
    verification: await updateStudioVerification(
      studioId,
      reviewerId,
      decision,
    ),
  };
}
import type {
  AdminWorkshopListQuery,
  AdminStudioListQuery,
  StudioApprovalStatus,
  WorkshopDecision,
} from './admin.schemas.js';
import {
  decideWorkshop,
  listStudiosForAdmin,
  listWorkshopsForAdmin as selectWorkshopsForAdmin,
  updateStudioStatus,
  countStudiosForAdmin,
  listStudioStatusHistory,
} from './admin.repository.js';
export async function getStudioForAdmin(studioId: string) {
  const studio = (await listStudiosForAdmin(undefined, undefined, studioId))[0];
  if (!studio)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ studio.');
  return {
    studio: {
      ...(await withStudioImages(studio)),
      statusHistory: await listStudioStatusHistory(studioId),
    },
  };
}

export async function getStudiosForAdmin(
  status?: StudioApprovalStatus,
  filters?: AdminStudioListQuery,
) {
  const scopedFilters: AdminStudioListQuery = {
    ...filters,
    page: filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    status: filters?.status ?? status ?? 'all',
  };
  const [studios, statusCounts] = await Promise.all([
    listStudiosForAdmin(undefined, scopedFilters),
    countStudiosForAdmin(scopedFilters),
  ]);
  return {
    studios: await Promise.all(studios.map(withStudioImages)),
    statusCounts,
    pagination: {
      page: scopedFilters.page!,
      pageSize: scopedFilters.pageSize!,
      total: statusCounts[scopedFilters.status ?? 'all'] ?? 0,
    },
  };
}

export async function setStudioStatus(
  studioId: string,
  status: StudioApprovalStatus,
  reviewerId: string,
  reason?: string,
) {
  const studio = await updateStudioStatus(studioId, status, reviewerId, reason);
  if (!studio) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio cần duyệt.');
  }
  return { studio: await withStudioImages(studio) };
}

export async function getWorkshopsForAdmin(filters: AdminWorkshopListQuery) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const result = await selectWorkshopsForAdmin({
    ...filters,
    status: filters.status ?? 'pending',
    page,
    pageSize,
  });
  return {
    workshops: result.workshops,
    pagination: { page, pageSize, total: result.total },
    statusCounts: result.statusCounts,
  };
}

export async function setWorkshopStatus(
  workshopId: string,
  reviewerId: string,
  decision: WorkshopDecision,
) {
  const result = await decideWorkshop(workshopId, reviewerId, decision);
  if (result.kind === 'not-found') {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop cần duyệt.');
  }
  if (result.kind === 'conflict') {
    throw new AppError(
      409,
      'CONFLICT',
      `Chỉ workshop đang chờ duyệt mới được xử lý (trạng thái hiện tại: ${result.currentStatus}).`,
    );
  }
  return { workshop: result.workshop };
}
