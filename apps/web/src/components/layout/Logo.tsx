import { cn } from '../../lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/open-slot-logo.svg`}
      alt="Open Slot"
      width={470}
      height={112}
      className={cn('h-auto w-36 shrink-0 sm:w-40', className)}
      decoding="async"
    />
  );
}
