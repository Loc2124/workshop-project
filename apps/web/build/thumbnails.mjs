import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import sharp from 'sharp';
const publicRoot = new URL('../public/', import.meta.url);
const manifest = {},
  thumbnails = {};
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = new URL(
      entry.name + (entry.isDirectory() ? '/' : ''),
      directory,
    );
    if (entry.isDirectory()) {
      await visit(source);
      continue;
    }
    if (!/\.(jpe?g|png)$/i.test(entry.name)) continue;
    const originalPath = fileURLToPath(source).replaceAll('\\', '/');
    const url =
      '/' +
      originalPath.slice(
        fileURLToPath(publicRoot).replaceAll('\\', '/').length,
      );
    const variants = {};
    for (const [name, side, quality, suffix] of [
      ['original', 1600, 84, '.webp'],
      ['medium', 960, 82, '.medium.webp'],
      ['thumbnail', 480, 80, '.thumb.webp'],
    ]) {
      const target = new URL(entry.name.replace(/\.[^.]+$/, suffix), directory);
      const info = await sharp(fileURLToPath(source))
        .rotate()
        .resize({
          width: side,
          height: side,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toFile(fileURLToPath(target));
      variants[name] = {
        src: url.replace(/\.[^.]+$/, suffix),
        width: info.width,
        height: info.height,
        bytes: info.size,
      };
    }
    for (const alias of [
      url,
      ...Object.values(variants).map((file) => file.src),
    ])
      manifest[alias] = variants;
    thumbnails[url] = variants.thumbnail.src;
    thumbnails[variants.original.src] = variants.thumbnail.src;
  }
}
await visit(new URL('images/', publicRoot));
await writeFile(
  new URL('../src/lib/image-variants.json', import.meta.url),
  JSON.stringify(manifest, null, 2) + '\n',
);
await writeFile(
  new URL('../src/lib/image-thumbnails.json', import.meta.url),
  JSON.stringify(thumbnails, null, 2) + '\n',
);
console.log(
  `Generated ${Object.keys(thumbnails).length / 2} responsive WebP image sets.`,
);
