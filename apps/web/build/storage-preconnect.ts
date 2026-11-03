import type { Plugin } from 'vite';
export function storagePreconnect(storageUrl?: string): Plugin {
  let origin = '';
  try {
    if (storageUrl) {
      const url = new URL(storageUrl);
      if (['https:', 'http:'].includes(url.protocol)) origin = url.origin;
    }
  } catch {
    /* Unconfigured storage does not add a remote connection. */
  }
  return {
    name: 'storage-origin-preconnect',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(
          '<!-- storage-preconnect -->',
          origin ? `<link rel="preconnect" href="${origin}" crossorigin>` : '',
        ),
    },
  };
}
