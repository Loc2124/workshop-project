import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-[#7A7367] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-porcelain disabled:cursor-not-allowed disabled:border-[#DDD6C4] disabled:bg-[#E6E1D3] disabled:text-[#8A8375] disabled:opacity-100',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
