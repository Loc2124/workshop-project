import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { imageSources, type ImageVariant } from '@/lib/image-sources';

export type ImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  thumbnailUrl?: string | null;
  thumbnail?: boolean;
  mediumUrl?: string | null;
  variant?: ImageVariant;
  fallbackSrc?: string;
};

const DEFAULT_FALLBACK = '/images/workshops/category-default.svg';

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
  fallbackSrc = DEFAULT_FALLBACK,
  onError,
  ...props
}: ImgProps) {
  const [hasError, setHasError] = useState(false);
  const source = imageSources(src, variant, { thumbnailUrl, mediumUrl });

  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && fallbackSrc) {
      setHasError(true);
    }
    onError?.(e);
  };

  const finalSrc = hasError ? fallbackSrc : source.src;
  const finalSrcSet = hasError ? undefined : (srcSet ?? source.srcSet);

  return (
    <img
      {...props}
      className={`app-img ${className ?? ''}`}
      src={finalSrc}
      srcSet={finalSrcSet}
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
      onError={handleError}
    />
  );
}
