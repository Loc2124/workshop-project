import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'main' };

export function PageContainer({ as: Tag = 'div', className, ...props }: Props) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-page px-4 md:px-6 lg:px-8',
        className,
      )}
      {...props}
    />
  );
}
