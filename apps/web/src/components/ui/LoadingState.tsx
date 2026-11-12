import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label?: string;
  variant?: 'inline' | 'section' | 'page';
  className?: string;
};

/** Shared pending state for authentication, access checks and data requests. */
export function LoadingState({
  label = 'Đang tải dữ liệu…',
  variant = 'section',
  className,
}: Props) {
  const Tag = variant === 'inline' ? 'span' : 'div';
  return (
    <Tag
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'items-center justify-center gap-2 text-center text-sm text-muted',
        variant === 'inline' ? 'inline-flex' : 'flex w-full px-4 py-8',
        variant === 'page' && 'min-h-(--loading-height,100svh)',
        className,
      )}
    >
      <LoaderCircle
        size={18}
        aria-hidden="true"
        className="shrink-0 motion-safe:animate-spin"
      />
      <span>{label}</span>
    </Tag>
  );
}
