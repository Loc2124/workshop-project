import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  Toaster: ({
    position,
    richColors,
    closeButton,
    offset,
    mobileOffset,
  }: {
    position?: string;
    richColors?: boolean;
    closeButton?: boolean;
    offset?: unknown;
    mobileOffset?: unknown;
  }) => (
    <div
      data-testid="toaster"
      data-position={position}
      data-rich-colors={richColors}
      data-close-button={closeButton}
      data-offset={JSON.stringify(offset)}
      data-mobile-offset={JSON.stringify(mobileOffset)}
    />
  ),
}));

import { AppToaster } from './AppToaster';

describe('AppToaster', () => {
  it('renders the shared toast viewport', () => {
    const markup = renderToStaticMarkup(<AppToaster />);

    expect(markup).toContain('data-testid="toaster"');
    expect(markup).toContain('data-position="top-right"');
    expect(markup).toContain('data-rich-colors="true"');
    expect(markup).toContain('data-close-button="true"');
    expect(markup).toContain('data-offset="{&quot;top&quot;:88}"');
    expect(markup).toContain('data-mobile-offset="{&quot;top&quot;:88}"');
  });
});
