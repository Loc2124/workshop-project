import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Props = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'className'
> & {
  src?: string | null;
  alt: string;
  placeholder: string;
  className?: string;
  imageClassName?: string;
  showPlaceholderText?: boolean;
};

export function MediaImage({
  src,
  alt,
  placeholder,
  className,
  imageClassName,
  showPlaceholderText = true,
  loading = 'lazy',
  ...props
}: Props) {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const loaded = Boolean(src && loadedUrl === src && failedUrl !== src);
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
      {src && failedUrl !== src && (
        <img
          {...props}
          src={src}
          alt={alt}
          loading={loading}
          aria-hidden={!loaded}
          onLoad={() => setLoadedUrl(src)}
          onError={() => setFailedUrl(src)}
          className={cn(
            'absolute inset-0 size-full object-cover',
            !loaded && 'opacity-0',
            imageClassName,
          )}
        />
      )}
    </div>
  );
}
