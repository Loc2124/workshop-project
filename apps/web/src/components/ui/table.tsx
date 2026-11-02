import * as React from 'react';
import { cn } from '../../lib/utils';
export const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentProps<'table'>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';
export function TableHeader(props: React.ComponentProps<'thead'>) {
  return <thead {...props} />;
}
export function TableBody(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}
export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-line transition-colors hover:bg-soft/60 data-[state=selected]:bg-soft',
        className,
      )}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-11 px-3 text-left align-middle text-xs font-medium text-muted',
        className,
      )}
      {...props}
    />
  );
}
export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-3 align-middle', className)} {...props} />;
}
