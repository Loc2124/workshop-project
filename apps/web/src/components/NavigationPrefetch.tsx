import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function NavigationPrefetch() {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovered: HTMLAnchorElement | null = null;
    const warm = (link: HTMLAnchorElement) => {
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        link.hasAttribute('download') ||
        link.target === '_blank' ||
        !/^\/(?:$|kham-pha|explore|workshops?\/|studios?(?:\/|$)|admin(?:\/|$)|me\/bookings)/.test(
          url.pathname,
        )
      )
        return;
      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (
        connection?.saveData ||
        /(^|-)2g$/.test(connection?.effectiveType ?? '')
      )
        return;
      void import('../lib/prefetch-navigation')
        .then(({ prefetchNavigation }) => prefetchNavigation(client, url))
        .catch(() => {});
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const link =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (link === hovered) return;
      if (timer) clearTimeout(timer);
      hovered = link;
      if (link) timer = setTimeout(() => warm(link), 120);
    };
    const out = (event: PointerEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        hovered?.contains(event.relatedTarget)
      )
        return;
      if (timer) clearTimeout(timer);
      hovered = null;
    };
    const focus = (event: FocusEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (link) warm(link);
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focus);
    };
  }, [client]);
  return null;
}
