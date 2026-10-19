import { AppError } from '../../errors/app-error.js';
import {
  findCandidates,
  getPublicWorkshop,
  type CatalogPage,
} from './catalog.repository.js';
import type { CatalogFilters } from './catalog.schemas.js';

export function listPublicWorkshops(
  filters: CatalogFilters,
): Promise<CatalogPage> {
  return findCandidates(filters);
}

export async function readPublicWorkshop(workshopId: string) {
  const workshop = await getPublicWorkshop(workshopId);
  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }
  return { workshop };
}
