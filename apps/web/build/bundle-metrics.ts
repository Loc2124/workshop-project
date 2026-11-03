import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
import budget from './performance-budget.json';
export function bundleMetrics(): Plugin {
  return {
    name: 'web-bundle-metrics',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const chunks = Object.values(bundle).filter(
          (item) => item.type === 'chunk',
        );
        const measure = (code: string) => ({
          bytes: Buffer.byteLength(code),
          gzipBytes: gzipSync(code, { level: 9 }).length,
        });
        const assets = chunks.map((chunk) => ({
          file: chunk.fileName,
          ...measure(chunk.code),
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          isEntry: chunk.isEntry,
          heavy: Object.keys(chunk.modules)
            .filter((id) =>
              /node_modules\/(?:recharts|@dnd-kit|@tanstack\/(?:react-table|table-core))\//.test(
                id.replaceAll('\\', '/'),
              ),
            )
            .map((id) =>
              id.replaceAll('\\', '/').split('/node_modules/').at(-1),
            ),
        }));
        // Image compression's on-demand worker is emitted as an asset rather
        // than a Rollup chunk; include it in total JS, outside the entry graph.
        for (const file of Object.values(bundle)) {
          if (file.type === 'asset' && file.fileName.endsWith('.js'))
            assets.push({
              file: file.fileName,
              ...measure(
                typeof file.source === 'string'
                  ? file.source
                  : Buffer.from(file.source).toString('utf8'),
              ),
              imports: [],
              dynamicImports: [],
              isEntry: false,
              heavy: [],
            });
        }
        const initial = new Set<string>();
        const visit = (file: string) => {
          if (initial.has(file)) return;
          initial.add(file);
          assets.find((a) => a.file === file)?.imports.forEach(visit);
        };
        assets.filter((a) => a.isEntry).forEach((a) => visit(a.file));
        const sum = (items: typeof assets) => ({
          bytes: items.reduce((n, a) => n + a.bytes, 0),
          gzipBytes: items.reduce((n, a) => n + a.gzipBytes, 0),
        });
        const first = assets.filter((a) => initial.has(a.file));
        const entry = assets.find((a) => a.isEntry);
        if (entry && entry.gzipBytes > budget.entryGzipBytes)
          this.error(
            `Entry gzip budget exceeded: ${entry.gzipBytes} > ${budget.entryGzipBytes} bytes`,
          );
        const leaks = first.filter((a) => a.heavy.length);
        if (leaks.length)
          this.error(
            `Admin libraries leaked into initial JS: ${leaks.map((a) => a.file).join(', ')}`,
          );
        // Studio routes share the shell, but must never pull admin-only libraries.
        initial.clear();
        assets
          .filter((a) =>
            /\/(StudioOverviewPage|StudioWorkspacePage|DashboardShell)-/.test(
              a.file,
            ),
          )
          .forEach((a) => visit(a.file));
        const studioLeaks = assets.filter(
          (a) => initial.has(a.file) && a.heavy.length,
        );
        if (studioLeaks.length)
          this.error(
            `Admin libraries leaked into studio routes: ${studioLeaks.map((a) => a.file).join(', ')}`,
          );
        initial.clear();
        assets
          .filter((a) =>
            /\/(HomePage|ExplorePage|StudioPage|WorkshopPage|ArtisanPage|AboutPage|LoginPage|RegisterPage|StudioRegistrationPage|PublicShell|AuthLayout)-/.test(
              a.file,
            ),
          )
          .forEach((a) => visit(a.file));
        const publicLeaks = assets.filter(
          (a) => initial.has(a.file) && a.heavy.length,
        );
        if (publicLeaks.length)
          this.error(
            `Admin libraries leaked into public routes: ${publicLeaks.map((a) => a.file).join(', ')}`,
          );
        const report = {
          entry: assets.find((a) => a.isEntry),
          initial: { ...sum(first), files: first.map((a) => a.file) },
          totalJs: sum(assets),
          assets,
        };
        this.emitFile({
          type: 'asset',
          fileName: 'bundle-metrics.json',
          source: JSON.stringify(report, null, 2),
        });
        console.log(
          `\nWeb bundle: initial JS ${(report.initial.bytes / 1000).toFixed(1)} kB / gzip ${(report.initial.gzipBytes / 1000).toFixed(1)} kB; total JS ${(report.totalJs.bytes / 1000).toFixed(1)} kB / gzip ${(report.totalJs.gzipBytes / 1000).toFixed(1)} kB.\n`,
        );
      },
    },
  };
}
