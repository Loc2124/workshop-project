/**
 * Tiện ích xác định CSS layout classes và padding an toàn trên mobile cho PublicShell.
 * Đảm bảo các trang có thanh tác vụ dính đáy (bottom sticky bar) luôn có khoảng đệm
 * an toàn pb-28 trên màn hình nhỏ để không bị che khuất nội dung.
 */

export function getPublicShellClasses(pathname: string): string {
  if (pathname === '/') {
    return 'home-page min-h-screen';
  }
  if (pathname.startsWith('/kham-pha') || pathname.startsWith('/explore')) {
    return 'explore-page min-h-screen';
  }
  if (pathname.startsWith('/studios/')) {
    // Studio page có mobile action bar dưới 768px (md)
    return 'min-h-screen pb-28 md:pb-0';
  }
  if (pathname.startsWith('/workshop')) {
    // Workshop detail có sticky booking bar dưới 1024px (lg)
    return 'min-h-screen pb-28 lg:pb-0';
  }
  if (pathname === '/dang-ky-studio') {
    return 'flex min-h-svh flex-col';
  }
  return 'min-h-svh';
}

const MARKETING_ROUTES = new Set(['/danh-cho-nghe-nhan', '/ve-open-slot']);

export function isMarketingPage(pathname: string): boolean {
  return MARKETING_ROUTES.has(pathname);
}
