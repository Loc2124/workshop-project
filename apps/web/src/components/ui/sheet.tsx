import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;
const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: 'left' | 'right';
    closeLabel?: string;
    closeDisabled?: boolean;
  }
>(
  (
    {
      className,
      children,
      side = 'left',
      closeLabel = 'Đóng menu điều hướng',
      closeDisabled,
      ...props
    },
    ref,
  ) => (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/35" />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col border-line bg-surface text-ink shadow-lg outline-none',
          side === 'right'
            ? 'right-0 w-full max-w-xl border-l'
            : 'left-0 w-64 max-w-[calc(100vw-3rem)] border-r',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-sm hover:bg-soft focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={closeLabel}
          disabled={closeDisabled}
        >
          <X size={18} />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  ),
);
SheetContent.displayName = SheetPrimitive.Content.displayName;
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
};
