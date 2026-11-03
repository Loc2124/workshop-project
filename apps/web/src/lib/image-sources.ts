import staticImages from './image-variants.json';
export type ImageVariant = 'thumbnail' | 'medium' | 'original';
export type ImageVariantUrls = {
  thumbnailUrl?: string | null;
  mediumUrl?: string | null;
};
type ImageFile = { src: string; width: number; height: number };
type ImageSet = Record<ImageVariant, ImageFile>;
export function imageSources(
  src: string | undefined,
  variant: ImageVariant,
  urls: ImageVariantUrls = {},
): { src?: string; srcSet?: string; width?: number; height?: number } {
  const local = src
    ? (staticImages as Record<string, ImageSet>)[src]
    : undefined;
  if (local) {
    const selected = local[variant];
    const candidates =
      variant === 'medium' ? [local.thumbnail, local.medium] : [selected];
    const unique = [
      ...new Map(candidates.map((file) => [file.width, file])).values(),
    ].sort((a, b) => a.width - b.width);
    return {
      src: selected.src,
      srcSet:
        variant === 'original'
          ? undefined
          : unique.map((file) => `${file.src} ${file.width}w`).join(', '),
      width: local.original.width,
      height: local.original.height,
    };
  }
  if (variant === 'thumbnail' && urls.thumbnailUrl)
    return { src: urls.thumbnailUrl, srcSet: `${urls.thumbnailUrl} 480w` };
  if (variant === 'medium' && urls.mediumUrl)
    return {
      src: urls.mediumUrl,
      srcSet: [
        urls.thumbnailUrl ? `${urls.thumbnailUrl} 480w` : null,
        `${urls.mediumUrl} 960w`,
      ]
        .filter(Boolean)
        .join(', '),
    };
  return { src, srcSet: undefined };
}
