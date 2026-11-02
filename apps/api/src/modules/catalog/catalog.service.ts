import { getImageUrlsForIds } from '../images/images.repository.js';
import { imagePublicUrl } from '../images/image-storage.js';
import { AppError } from '../../errors/app-error.js';
import {
  findCandidates,
  findStudioCandidates,
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

export function listPublicStudios(filters: CatalogFilters) {
  return findStudioCandidates(filters);
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
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  const { photoIds, ...publicStudio } = studio as typeof studio & {
    photoIds?: string[];
  };
  const photos = await getImageUrlsForIds(photoIds ?? []);
  return {
    studio: {
      ...publicStudio,
      photoUrls: photos.map((photo) => imagePublicUrl(photo.key)),
    },
  };
}

export async function readProvinces(includeEmpty = false) {
  return { provinces: await listProvinces(includeEmpty) };
}

export async function readAreas(provinceId: string) {
  return { areas: await listAreas(provinceId) };
}
