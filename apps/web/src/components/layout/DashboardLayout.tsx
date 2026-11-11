import { Img } from '../ui/Img';
import { cn } from '../../lib/utils';
import './studio-workspace.css';
import { prefetchDashboardRoute } from '../../lib/dashboard-routes';
import { DashboardSkeleton } from './DashboardSkeleton';
import { Fragment, Suspense, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  LogOut,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react';
import type { AuthUser } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '../ui/sidebar';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { Logo } from './Logo';
import { NotificationsMenu } from './NotificationsMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export type DashboardMenuItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  locked?: boolean;
  attention?: boolean;
};
export type DashboardLayoutProps = {
  menuItems: DashboardMenuItem[];
  roleLabel: 'Quản lý studio' | 'Quản trị' | 'Nhân viên studio';
  user: AuthUser & { avatarUrl?: string };
  studioSwitcher?: ReactNode;
  workspace?: { name: string; to: string };
};
export function activeDashboardItem(
  items: DashboardMenuItem[],
  pathname: string,
) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/studio/studios/'))
    return items.find((item) => item.to.split('?')[0] === '/studio');
  return items
    .filter((item) => {
      const target = item.to.split('?')[0].replace(/\/+$/, '');
      return (
        path === target ||
        (target !== '/studio' &&
          target !== '/admin' &&
          path.startsWith(target + '/'))
      );
    })
    .sort(
      (left, right) =>
        right.to.split('?')[0].length - left.to.split('?')[0].length,
    )[0];
}
function DashboardSidebar({
  menuItems,
  roleLabel,
  studioSwitcher,
}: Pick<DashboardLayoutProps, 'menuItems' | 'roleLabel' | 'studioSwitcher'>) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const selected = activeDashboardItem(menuItems, pathname);
  return (
    <Sidebar
      collapsible="icon"
      mobileClassName={
        roleLabel === 'Quản lý studio'
          ? 'studio-shell studio-sidebar-drawer'
          : undefined
      }
    >
      <DashboardBrand roleLabel={roleLabel} />
      {studioSwitcher}
      <SidebarContent>
        <nav aria-label={roleLabel}>
          <SidebarGroup>
            <DashboardRoleLabel roleLabel={roleLabel} />
            <SidebarMenu>
              {menuItems.map(({ label, to, icon: Icon, locked, attention }) => (
                <SidebarMenuItem key={label}>
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          aria-label={label}
                          aria-disabled="true"
                          className="cursor-not-allowed opacity-60"
                        >
                          <LockKeyhole aria-hidden="true" />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Mở sau khi studio được duyệt
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={selected?.label === label}
                      tooltip={label}
                    >
                      <Link
                        to={to}
                        onMouseEnter={() => prefetchDashboardRoute(to)}
                        onFocus={() => prefetchDashboardRoute(to)}
                        aria-label={label}
                        aria-current={
                          selected?.label === label ? 'page' : undefined
                        }
                        onClick={() => setOpenMobile(false)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                        {attention && (
                          <i
                            className="size-2 shrink-0 rounded-full bg-brick"
                            aria-label="Hồ sơ cần chỉnh sửa"
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
function DashboardBrand({
  roleLabel,
}: Pick<DashboardLayoutProps, 'roleLabel'>) {
  const { state } = useSidebar();
  return (
    <SidebarHeader className={state === 'collapsed' ? 'px-2' : undefined}>
      <Link
        to={roleLabel === 'Quản trị' ? '/admin' : '/studio'}
        aria-label={`Open Slot — ${roleLabel}`}
        className="flex min-h-11 w-full items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:ring-primary"
      >
        {state === 'expanded' ? (
          <Logo className="w-32 sm:w-32" />
        ) : (
          <Img
            src="/brand/open-slot-symbol.svg"
            width={28}
            height={28}
            alt="Open Slot"
            className="size-7"
          />
        )}
      </Link>
    </SidebarHeader>
  );
}
function DashboardRoleLabel({
  roleLabel,
}: Pick<DashboardLayoutProps, 'roleLabel'>) {
  const { state } = useSidebar();
  return (
    <p
      className={
        state === 'expanded'
          ? 'px-3 pb-3 pt-1 text-xs font-medium text-muted'
          : 'sr-only'
      }
    >
      {roleLabel}
    </p>
  );
}

export function DashboardLayout({
  menuItems,
  roleLabel,
  user,
  studioSwitcher,
  workspace,
}: DashboardLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, isLoggingOut } = useAuth();
  const root = roleLabel === 'Quản trị' ? '/admin' : '/studio';
  const selected = activeDashboardItem(menuItems, pathname);
  const detail = pathname.startsWith('/studio/studios/');
  const currentLabel = detail
    ? 'Chi tiết studio'
    : (selected?.label ?? roleLabel);
  const breadcrumbs = workspace
    ? [
        { label: workspace.name, to: workspace.to },
        { label: selected?.label ?? 'Tổng quan' },
      ]
    : pathname === root
      ? [{ label: selected?.label ?? roleLabel }]
      : [{ label: roleLabel, to: root }, { label: currentLabel }];
  const initials = (
    user.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(-2)
      .join('') || user.email.slice(0, 2)
  ).toUpperCase();
  async function signOut() {
    try {
      await logout();
      toast.success('Đã đăng xuất.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Chưa đăng xuất được. Vui lòng thử lại.',
      );
    }
  }
  return (
    <SidebarProvider
      className={cn(
        'dashboard-shell text-sm text-ink [--loading-height:calc(100svh-5.5rem)] md:[--loading-height:calc(100svh-6.5rem)] lg:[--loading-height:calc(100svh-7rem)]',
        roleLabel === 'Quản lý studio' ? 'studio-shell' : 'bg-[#f7f7f5]',
      )}
    >
      <a
        href="#dashboard-content"
        className="sr-only fixed left-20 top-2 z-60 rounded-sm bg-surface p-3 focus:not-sr-only"
      >
        Đến nội dung chính
      </a>
      <DashboardSidebar
        menuItems={menuItems}
        roleLabel={roleLabel}
        studioSwitcher={studioSwitcher}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-line bg-surface px-2 md:px-5">
          <div className="flex min-w-0 items-center gap-1 md:gap-3">
            <SidebarTrigger />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap">
                {breadcrumbs.map((crumb, index) => (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 && (
                      <BreadcrumbSeparator className="hidden sm:block" />
                    )}
                    <BreadcrumbItem
                      className={
                        index < breadcrumbs.length - 1
                          ? 'hidden sm:inline-flex'
                          : 'min-w-0'
                      }
                    >
                      {'to' in crumb && crumb.to ? (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="truncate text-sm">
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-3">
            <NotificationsMenu userId={user.id} />
            <Link
              to="/"
              aria-label="Về trang khách"
              title="Về trang khách"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-2 text-sm text-muted hover:bg-soft hover:text-ink"
            >
              <ArrowUpRight size={16} />
              <span className="hidden md:inline">Về trang khách</span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex min-h-11 items-center gap-2 rounded-sm px-1.5 outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Menu tài khoản"
              >
                <Avatar>
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate text-sm lg:inline">
                  {user.fullName}
                </span>
                <ChevronDown size={14} className="hidden text-muted sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="font-semibold text-ink">{user.fullName}</p>
                  <p className="max-w-60 truncate pt-1">{user.email}</p>
                  <p className="pt-1">{roleLabel}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isLoggingOut}
                  onSelect={() => void signOut()}
                >
                  <LogOut />
                  {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          id="dashboard-content"
          tabIndex={-1}
          className="dashboard-content mx-auto w-full max-w-5xl min-w-0 p-3 outline-none md:p-5 lg:p-6"
        >
          <Suspense fallback={<DashboardSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
