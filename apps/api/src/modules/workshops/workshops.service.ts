import { AppError } from '../../errors/app-error.js';
import {
  createWorkshop as insertWorkshop,
  listWorkshops as selectWorkshops,
  updateWorkshop as saveWorkshop,
} from './workshops.repository.js';
import type {
  WorkshopInput,
  WorkshopUpdateInput,
} from './workshops.schemas.js';

export async function getOrganizerWorkshops(organizerId: string) {
  return { workshops: await selectWorkshops(organizerId) };
}

export async function createOrganizerWorkshop(
  organizerId: string,
  input: WorkshopInput,
) {
  const workshop = await insertWorkshop(organizerId, input);

  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn vị tổ chức.');
  }

  return { workshop };
}

export async function updateOrganizerWorkshop(
  organizerId: string,
  workshopId: string,
  input: WorkshopUpdateInput,
) {
  const workshop = await saveWorkshop(organizerId, workshopId, input);

  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }

  return { workshop };
}
