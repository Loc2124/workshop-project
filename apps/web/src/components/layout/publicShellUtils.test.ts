import { describe, it, expect } from 'vitest';
import { getPublicShellClasses, isMarketingPage } from './publicShellUtils';

describe('publicShellUtils', () => {
  it('áp dụng class home-page cho trang chủ', () => {
    expect(getPublicShellClasses('/')).toBe('home-page min-h-screen');
  });

  it('áp dụng class explore-page cho trang khám phá', () => {
    expect(getPublicShellClasses('/kham-pha')).toBe('explore-page min-h-screen');
    expect(getPublicShellClasses('/explore')).toBe('explore-page min-h-screen');
    expect(getPublicShellClasses('/kham-pha?category=gom')).toBe('explore-page min-h-screen');
  });

  it('bảo đảm có đệm đáy an toàn trên mobile cho trang studio (pb-28 md:pb-0)', () => {
    const classes = getPublicShellClasses('/studios/tiem-gom-sai-gon');
    expect(classes).toContain('pb-28');
    expect(classes).toContain('md:pb-0');
  });

  it('bảo đảm có đệm đáy an toàn trên mobile/tablet cho trang workshop (pb-28 lg:pb-0)', () => {
    const classes = getPublicShellClasses('/workshop/lam-gom-thu-cong');
    expect(classes).toContain('pb-28');
    expect(classes).toContain('lg:pb-0');
  });

  it('xác định đúng các trang marketing', () => {
    expect(isMarketingPage('/danh-cho-nghe-nhan')).toBe(true);
    expect(isMarketingPage('/ve-open-slot')).toBe(true);
    expect(isMarketingPage('/')).toBe(false);
    expect(isMarketingPage('/kham-pha')).toBe(false);
  });
});
