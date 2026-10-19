import { AppError } from '../../errors/app-error.js';
import type { OrganizerApprovalStatus } from './admin.schemas.js';
import {
  listOrganizersForAdmin,
  updateOrganizerStatus,
} from './admin.repository.js';

export async function getOrganizersForAdmin(
  status?: OrganizerApprovalStatus,
): Promise<{
  organizers: Array<{
    id: string;
    userId: string;
    userFullName: string;
    name: string;
    description: string | null;
    address: string | null;
    district: string | null;
    status: OrganizerApprovalStatus;
    createdAt: string;
  }>;
}> {
  const organizers = await listOrganizersForAdmin(status);

  return {
    organizers: organizers.map((organizer) => ({
      id: organizer.id,
      userId: organizer.userId,
      userFullName: organizer.userFullName,
      name: organizer.name,
      description: organizer.description,
      address: organizer.address,
      district: organizer.district,
      status: organizer.status,
      createdAt: organizer.createdAt,
    })),
  };
}

export async function setOrganizerStatus(
  organizerId: string,
  status: OrganizerApprovalStatus,
): Promise<{
  organizer: {
    id: string;
    userId: string;
    userFullName: string;
    name: string;
    description: string | null;
    address: string | null;
    district: string | null;
    status: OrganizerApprovalStatus;
    createdAt: string;
  };
}> {
  const organizer = await updateOrganizerStatus(organizerId, status);

  if (!organizer) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy đơn vị tổ chức cần duyệt.',
    );
  }

  return {
    organizer: {
      id: organizer.id,
      userId: organizer.userId,
      userFullName: organizer.userFullName,
      name: organizer.name,
      description: organizer.description,
      address: organizer.address,
      district: organizer.district,
      status: organizer.status,
      createdAt: organizer.createdAt,
    },
  };
}
