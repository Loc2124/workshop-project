import { Img } from '../ui/Img';
import { useState, type ReactNode } from 'react';
import {
  DEFAULT_CATEGORY,
  getCategoryIcon,
  getCategoryMeta,
} from '../../constants/categories';
import { cn } from '../../lib/utils';

export function TicketStub({
  imageUrl,
  thumbnailUrl,
  priority = false,
  alt,
  categoryId,
  featured = false,
  children,
}: {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  priority?: boolean;
  alt: string;
  categoryId?: string;
  featured?: boolean;
  children: ReactNode;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const category = getCategoryMeta(categoryId);
  const displaySource = [
    imageUrl,
    category.placeholderImage,
    DEFAULT_CATEGORY.placeholderImage,
  ].find((url): url is string => Boolean(url && !failedUrls.includes(url)));
  const hasImage = Boolean(displaySource && loadedUrl === displaySource);
  const Icon = getCategoryIcon(categoryId);
  const objectPosition = category.imagePosition;
  return (
    <div
      className={cn(
        'horizontal-ticket-stub relative w-[var(--stub-width,28%)] shrink-0 bg-beige',
        featured && 'sm:w-[var(--stub-width)]',
      )}
    >
      {displaySource && (
        <Img
          thumbnail
          thumbnailUrl={displaySource === imageUrl ? thumbnailUrl : undefined}
          priority={priority}
          src={displaySource}
          alt={imageUrl && displaySource === imageUrl ? alt : ''}
          loading="lazy"
          onLoad={() => setLoadedUrl(displaySource)}
          onError={() => {
            setLoadedUrl(undefined);
            setFailedUrls((urls) => [...urls, displaySource]);
          }}
          style={{ objectPosition }}
          className={cn(
            'absolute inset-0 size-full object-cover',
            !hasImage && !priority && 'opacity-0',
          )}
        />
      )}
      {hasImage && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        />
      )}
      <div
        className={cn(
          'relative flex h-full flex-col p-3 lg:p-5',
          hasImage ? 'text-white' : 'text-stone-700',
        )}
      >
        {!hasImage && (
          <Icon size={22} aria-hidden="true" className="shrink-0" />
        )}
        <div className="mt-auto flex flex-col pt-8 tabular-nums">
          {children}
        </div>
      </div>
    </div>
  );
}
