import type { ReactNode } from 'react';
import { ArrowUpRight, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { MediaImage } from '../ui/MediaImage';

export function DetailHero({
  imageUrl,
  alt,
  children,
  imageOnRight = false,
  compact = false,
}: {
  imageUrl?: string;
  alt: string;
  children: ReactNode;
  imageOnRight?: boolean;
  compact?: boolean;
}) {
  return (
    <section className="grid min-w-0 overflow-hidden rounded-2xl bg-stone-50 lg:grid-cols-[1.1fr_1fr]">
      <MediaImage
        src={imageUrl}
        alt={alt}
        placeholder={alt}
        loading="eager"
        fetchPriority="high"
        width={900}
        height={720}
        imageClassName="object-[65%_60%] motion-safe:transition-transform motion-safe:duration-700 motion-safe:hover:scale-[1.025]"
        className={cn(
          'h-52 w-full sm:h-80 lg:h-full',
          compact ? 'lg:min-h-[400px]' : 'lg:min-h-[520px]',
          imageOnRight && 'lg:order-2',
        )}
      />
      <div
        className={cn(
          'flex min-w-0 flex-col lg:justify-center',
          compact ? 'p-5 lg:p-6' : 'px-5 py-6 sm:p-8 lg:p-10',
          imageOnRight && 'lg:order-1',
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function DetailRating({
  rating,
  count,
}: {
  rating?: number;
  count?: number;
}) {
  if (rating === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-ink">
      <Star size={16} aria-hidden="true" className="fill-current text-rating" />
      {rating.toFixed(1)}
      <span className="font-normal text-stone-700">
        ({count ?? 0} đánh giá)
      </span>
    </span>
  );
}

export function DetailSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2
        id={id}
        className="mb-5 font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function VisitStudio({
  name,
  address,
  province,
  href,
}: {
  name: string;
  address?: string | null;
  province: string;
  href?: string;
}) {
  const query = [name, address?.replace(/^Địa chỉ mô phỏng:\s*/i, ''), province]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="rounded-2xl bg-soft p-5 sm:p-6">
      <MapPin size={22} aria-hidden="true" className="mb-5 text-primary" />
      <h3 className="font-heading text-xl font-semibold">Hẹn gặp ở studio</h3>
      {href ? (
        <Link
          to={href}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-primary hover:underline"
        >
          {name}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-4 font-semibold">{name}</p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-stone-700">
        {address || province}
      </p>
      {address && <p className="mt-1 text-sm text-stone-700">{province}</p>}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
      >
        Xem đường đi
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  );
}

export function DetailState({
  loading,
  error,
  label,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  label: string;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <div role="status" className="py-8">
        <h1 className="sr-only">Đang tải {label}</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-2xl bg-beige motion-safe:animate-pulse" />
          <div className="space-y-5 py-5">
            <div className="h-10 w-3/4 rounded bg-beige" />
            <div className="h-24 rounded bg-soft" />
            <div className="h-11 w-44 rounded-lg bg-beige" />
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex min-h-80 flex-col items-start justify-center gap-5">
      <h1 className="font-heading text-3xl font-semibold">
        {error ? `Chưa tải được ${label}` : `Không tìm thấy ${label}`}
      </h1>
      <div className="flex flex-wrap gap-4">
        {error && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white"
          >
            Thử lại
          </button>
        )}
        <Link
          to="/kham-pha"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Quay lại khám phá
        </Link>
      </div>
    </div>
  );
}
