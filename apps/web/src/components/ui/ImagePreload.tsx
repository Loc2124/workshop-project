import { imageSources } from '@/lib/image-sources';
export function ImagePreload({ src }: { src: string }) {
  const image = imageSources(src, 'medium');
  return (
    <link
      rel="preload"
      as="image"
      href={image.src}
      imageSrcSet={image.srcSet}
      imageSizes="(max-width: 767px) 100vw, 960px"
      fetchPriority="high"
    />
  );
}
