import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';
describe('status badges', () => {
  it('maps the five review states and keeps unknown states neutral', () => {
    for (const [status, color] of Object.entries({
      draft: 'neutral',
      pending: 'amber',
      approved: 'emerald',
      rejected: 'red',
      needs_changes: 'orange',
    }))
      expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(
        `bg-${color}-`,
      );
    expect(renderToStaticMarkup(<StatusBadge status="custom" />)).toContain(
      'bg-neutral-100',
    );
  });
});
