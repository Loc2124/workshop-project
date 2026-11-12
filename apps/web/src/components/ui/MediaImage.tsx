import { Img, type ImgProps } from './Img';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<ImgProps, 'src' | 'alt' | 'className'> & {
  src?: string | null;
  alt: string;
  placeholder: string;
  className?: string;
  imageClassName?: string;
  showPlaceholderText?: boolean;
  fallbackSrc?: string;
};

export function MediaImage({
  src,
  alt,
  placeholder,
  className,
  imageClassName,
  showPlaceholderText = true,
  loading = 'lazy',
  priority = false,
  fallbackSrc,
  ...props
}: Props) {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const displaySrc = [src, fallbackSrc].find((value): value is string =>
    Boolean(value && !failedUrls.includes(value)),
  );
  const loaded = Boolean(displaySrc && loadedUrl === displaySrc);
  return (
    <div
      className={cn(
        'relative isolate min-w-0 overflow-hidden bg-beige',
        className,
      )}
    >
      {!loaded && (
        <span
          className="absolute inset-0 grid place-items-center p-4 text-center font-heading text-xl font-bold text-ink"
          role="img"
          aria-label={`Ảnh minh họa ${placeholder}`}
        >
          {showPlaceholderText && placeholder}
        </span>
      )}
      {displaySrc && (
        <Img
          {...props}
          priority={priority}
          src={displaySrc}
          alt={alt}
          loading={loading}
          aria-hidden={!loaded}
          onLoad={() => setLoadedUrl(displaySrc)}
          onError={() => setFailedUrls((values) => [...values, displaySrc])}
          className={cn(
            'absolute inset-0 size-full object-cover',
            !loaded && !priority && 'opacity-0',
            imageClassName,
          )}
        />
      )}
    </div>
  );
}
