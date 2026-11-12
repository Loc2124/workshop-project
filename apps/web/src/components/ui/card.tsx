import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-md border border-line bg-surface text-ink',
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('space-y-1.5 p-5', className)}
      {...props}
    />
  );
}
export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="card-title"
      className={cn('font-heading text-lg font-semibold', className)}
      {...props}
    />
  );
}
export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted', className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('p-5 pt-0', className)}
      {...props}
    />
  );
}
