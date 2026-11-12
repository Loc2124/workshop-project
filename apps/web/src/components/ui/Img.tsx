import type { ImgHTMLAttributes } from 'react';
import { imageSources, type ImageVariant } from '@/lib/image-sources';

export type ImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  thumbnailUrl?: string | null;
  thumbnail?: boolean;
  mediumUrl?: string | null;
  variant?: ImageVariant;
};

/** CSS controls the rendered size; intrinsic dimensions reserve image space. */
export function Img({
  priority = false,
  thumbnailUrl,
  thumbnail = false,
  mediumUrl,
  variant = thumbnail ? 'thumbnail' : 'medium',
  src,
  width,
  height,
  className,
  srcSet,
  sizes,
  loading = 'lazy',
  ...props
}: ImgProps) {
  const source = imageSources(src, variant, { thumbnailUrl, mediumUrl });
  return (
    <img
      {...props}
      className={`app-img ${className ?? ''}`}
      src={source.src}
      srcSet={srcSet ?? source.srcSet}
      sizes={
        sizes ??
        (variant === 'thumbnail'
          ? '(max-width: 767px) 128px, 320px'
          : '(max-width: 767px) 100vw, 960px')
      }
      width={width ?? source.width}
      height={height ?? source.height}
      decoding="async"
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : props.fetchPriority}
    />
  );
}
