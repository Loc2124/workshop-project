// shadcn/ui Sidebar composition, adapted to Open Slot's compact icon rail and existing tokens.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './sheet';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './tooltip';

type SidebarContextValue = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
};
const SidebarContext = React.createContext<SidebarContextValue | null>(null);
export function useSidebar() {
  const value = React.useContext(SidebarContext);
  if (!value) throw new Error('SidebarProvider is required.');
  return value;
}
function useMedia(query: string) {
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
export function SidebarProvider({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const compact = useMedia('(max-width: 1023px)');
  const isMobile = useMedia('(max-width: 767px)');
  const [open, setOpen] = React.useState(
    () =>
      typeof window === 'undefined' ||
      window.matchMedia('(min-width: 1024px)').matches,
  );
  const [openMobile, setOpenMobile] = React.useState(false);
  React.useEffect(() => {
    setOpen(!compact);
    setOpenMobile(false);
  }, [compact, isMobile]);
  const toggleSidebar = React.useCallback(
    () =>
      isMobile ? setOpenMobile((value) => !value) : setOpen((value) => !value),
    [isMobile],
  );
  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state: !isMobile && open ? 'expanded' : 'collapsed',
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [open, isMobile, openMobile, toggleSidebar],
  );
  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={150}>
        <div
          data-slot="sidebar-wrapper"
          className={cn('flex min-h-svh w-full min-w-0', className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}
export function Sidebar({
  children,
  className,
  mobileClassName,
  collapsible = 'icon',
  ...props
}: React.ComponentProps<'aside'> & {
  collapsible?: 'icon';
  mobileClassName?: string;
}) {
  const context = useSidebar();
  const { state, isMobile, openMobile, setOpenMobile } = context;
  return (
    <>
      <aside
        id="dashboard-sidebar"
        data-slot="sidebar"
        data-state={state}
        data-collapsible={collapsible}
        className={cn(
          'group/sidebar sticky top-0 z-30 flex h-svh shrink-0 flex-col border-r border-line bg-surface',
          state === 'expanded' ? 'w-56' : 'w-16',
          className,
        )}
        {...props}
      >
        {children}
      </aside>
      {isMobile && (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent
            className={mobileClassName}
            id="dashboard-sidebar-mobile"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById('dashboard-sidebar-trigger')?.focus();
            }}
          >
            <SheetTitle className="sr-only">Điều hướng quản lý</SheetTitle>
            <SheetDescription className="sr-only">
              Chọn trang trong khu vực quản lý của bạn.
            </SheetDescription>
            <SidebarContext.Provider value={{ ...context, state: 'expanded' }}>
              {children}
            </SidebarContext.Provider>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
  return (
    <Button
      id="dashboard-sidebar-trigger"
      type="button"
      variant="ghost"
      size="icon"
      aria-label={
        state === 'expanded' ? 'Thu gọn menu điều hướng' : 'Mở menu điều hướng'
      }
      aria-expanded={isMobile ? openMobile : state === 'expanded'}
      aria-controls={
        isMobile ? 'dashboard-sidebar-mobile' : 'dashboard-sidebar'
      }
      className={cn('shrink-0 rounded-sm', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft size={18} />
    </Button>
  );
}
export function SidebarInset({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('min-w-0 flex-1', className)}
      {...props}
    />
  );
}
export function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        'flex h-16 shrink-0 items-center border-b border-line px-3',
        className,
      )}
      {...props}
    />
  );
}
export function SidebarContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3',
        className,
      )}
      {...props}
    />
  );
}
export function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn('border-t border-line p-3', className)}
      {...props}
    />
  );
}
export function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn('min-w-0', className)}
      {...props}
    />
  );
}
export function SidebarMenu({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn('space-y-1', className)}
      {...props}
    />
  );
}
export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn('min-w-0', className)}
      {...props}
    />
  );
}
export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string;
  }
>(
  (
    { asChild = false, isActive = false, tooltip, className, ...props },
    ref,
  ) => {
    const { state } = useSidebar();
    const Comp = asChild ? Slot : 'button';
    const button = (
      <Comp
        ref={ref}
        data-slot="sidebar-menu-button"
        data-active={isActive}
        className={cn(
          'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-sm px-3 text-sm outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-primary [&>svg]:size-[18px] [&>svg]:shrink-0',
          isActive ? 'bg-soft font-semibold text-ink' : 'text-muted',
          state === 'collapsed' && 'justify-center px-0 [&>span]:hidden',
          className,
        )}
        {...props}
      />
    );
    return state === 'collapsed' && tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    ) : (
      button
    );
  },
);
SidebarMenuButton.displayName = 'SidebarMenuButton';
