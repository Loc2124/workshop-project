import { AppError } from '../../errors/app-error.js';
import {
  findCandidates,
  getPublicStudio,
  getPublicWorkshop,
  listAreas,
  listProvinces,
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

export async function readPublicStudio(studioId: string) {
  const studio = await getPublicStudio(studioId);
  if (!studio) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy xưởng.');
  }
  return { studio };
}

export async function readProvinces() {
  return { provinces: await listProvinces() };
}

export async function readAreas(provinceId: string) {
  return { areas: await listAreas(provinceId) };
}
