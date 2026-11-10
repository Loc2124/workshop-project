import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';
describe('status badges', () => {
  it('maps the five review states and keeps unknown states neutral', () => {
    for (const [status, className] of Object.entries({
      draft: 'bg-[#E8E4D8]',
      pending: 'bg-[#FBE8B5]',
      approved: 'bg-[#DCEFC8]',
      rejected: 'bg-[#FCE0DB]',
      needs_changes: 'bg-[#FCE0DB]',
    }))
      expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(
        className,
      );
    expect(renderToStaticMarkup(<StatusBadge status="custom" />)).toContain(
      'bg-[#E8E4D8]',
    );
  });
});
