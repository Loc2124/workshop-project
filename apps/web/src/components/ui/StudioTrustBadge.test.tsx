import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioTrustBadge } from './StudioTrustBadge';

describe('studio trust labels', () => {
  it('does not invent trust for pending studios or demo data without a level', () => {
    expect(renderToStaticMarkup(<StudioTrustBadge />)).toBe('');
    expect(renderToStaticMarkup(<StudioTrustBadge level="unapproved" />)).toBe(
      '',
    );
  });
  it('distinguishes profile approval from identity verification', () => {
    const html = renderToStaticMarkup(
      <StudioTrustBadge level="approved" explain />,
    );
    expect(html).toContain('Đã duyệt hồ sơ');
    expect(html).toContain('chưa được cấp xác minh danh tính');
  });
  it('explains the scope of verified identity without promising experience quality', () => {
    const html = renderToStaticMarkup(
      <StudioTrustBadge level="verified" explain />,
    );
    expect(html).toContain('Đã xác minh');
    expect(html).toContain('không phải cam kết về chất lượng');
  });
});
