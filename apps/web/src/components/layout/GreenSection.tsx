import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageContainer } from './PageContainer';

export function GreenSection({
  labelledBy,
  children,
  className,
  contentClassName,
}: {
  labelledBy: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn('my-16 bg-primary text-white md:my-28', className)}
    >
      <PageContainer
        className={cn(
          'grid gap-10 py-12 md:grid-cols-2 md:gap-8 lg:gap-20 lg:py-18',
          contentClassName,
        )}
      >
        {children}
      </PageContainer>
    </section>
  );
}
