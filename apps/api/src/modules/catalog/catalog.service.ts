import { getImageUrlsForIds } from '../images/images.repository.js';
import { imagePublicUrl } from '../images/image-storage.js';
import { attachCoverImages } from '../images/image-variants.js';
import { presentImage } from '../images/images.service.js';
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

export async function listPublicWorkshops(
  filters: CatalogFilters,
): Promise<CatalogPage> {
  const page = await findCandidates(filters);
  return { ...page, items: await attachCoverImages(page.items, 'workshop') };
}

export async function listPublicStudios(filters: CatalogFilters) {
  const page = await findStudioCandidates(filters);
  return { ...page, items: await attachCoverImages(page.items, 'studio') };
}

export async function readPublicWorkshop(workshopId: string) {
  const workshop = await getPublicWorkshop(workshopId);
  if (!workshop) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }
  return { workshop: (await attachCoverImages([workshop], 'workshop'))[0] };
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
      photoImages: photos.map((photo) => {
        const image = presentImage(photo);
        return {
          url: image.url,
          ...(image.thumbnailUrl ? { thumbnailUrl: image.thumbnailUrl } : {}),
          ...(image.mediumUrl ? { mediumUrl: image.mediumUrl } : {}),
        };
      }),
      workshops: await attachCoverImages(publicStudio.workshops, 'workshop'),
    },
  };
}

export async function readProvinces(includeEmpty = false) {
  return { provinces: await listProvinces(includeEmpty) };
}

export async function readAreas(provinceId: string) {
  return { areas: await listAreas(provinceId) };
}
