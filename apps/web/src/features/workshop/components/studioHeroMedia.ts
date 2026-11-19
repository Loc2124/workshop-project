import type { Studio } from '@/types/studio';
import type { Workshop } from '@/types/workshop';

// These project assets contain placeholder motifs, not studio cover photos.
const motifImages = new Set([
  '/images/workshops/category-default.svg',
  '/images/workshops/pottery-painting.svg',
  '/images/workshops/acrylic-painting.svg',
  '/images/workshops/flower-bouquet.svg',
  '/images/workshops/perfume-neutral.svg',
]);

export function studioHeroImage(
  studio: Pick<Studio, 'imageUrl'>,
  workshops: Workshop[],
  override?: string,
) {
  // Match ExplorePage's source order without changing its listing adapter.
  const source =
    override ??
    studio.imageUrl ??
    workshops.find((item) => item.imageUrl)?.imageUrl;
  if (!source?.trim()) return undefined;
  const path = source.split(/[?#]/)[0];
  return motifImages.has(path) ? undefined : source;
}
