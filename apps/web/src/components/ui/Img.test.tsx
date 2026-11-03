import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Img } from './Img';

it('reserves dimensions and uses list thumbnails with lazy asynchronous decoding', () => {
  const html = renderToStaticMarkup(
    <Img
      src="/images/workshops/stampPhoto.jpg"
      alt=""
      width={480}
      height={360}
      thumbnail
    />,
  );
  expect(html).toContain('stampPhoto.thumb.webp');
  expect(html).toContain('width="480"');
  expect(html).toContain('height="360"');
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('decoding="async"');
});
it('loads priority photos eagerly at high fetch priority', () => {
  const html = renderToStaticMarkup(<Img src="/hero.webp" alt="" priority />);
  expect(html).toContain('loading="eager"');
  expect(html).toContain('fetchPriority="high"');
  expect(html).not.toContain('loading="lazy"');
});

it('selects medium responsive sources for a hero without downloading its original', () => {
  const html = renderToStaticMarkup(
    <Img src="/images/workshops/stampPhoto.webp" alt="" priority />,
  );
  expect(html).toContain('stampPhoto.medium.webp');
  expect(html).toContain('stampPhoto.thumb.webp');
  expect(html).toContain('srcSet=');
  expect(html).toContain('sizes=');
  expect(html).not.toContain('src="/images/workshops/stampPhoto.webp"');
});
it('keeps uploaded legacy images when a requested variant is absent', () => {
  const html = renderToStaticMarkup(
    <Img
      src="https://storage.example.test/legacy.webp"
      alt=""
      variant="medium"
      thumbnailUrl="https://storage.example.test/thumb.webp"
    />,
  );
  expect(html).toContain('src="https://storage.example.test/legacy.webp"');
  expect(html).not.toContain('srcSet=');
});
it('uses upload variants and leaves originals for a large gallery', () => {
  const props = {
    src: 'https://storage.example.test/original.webp',
    thumbnailUrl: 'https://storage.example.test/thumb.webp',
    mediumUrl: 'https://storage.example.test/medium.webp',
    alt: '',
  };
  expect(
    renderToStaticMarkup(<Img {...props} variant="thumbnail" />),
  ).toContain('src="https://storage.example.test/thumb.webp"');
  const hero = renderToStaticMarkup(<Img {...props} variant="medium" />);
  expect(hero).toContain(
    'https://storage.example.test/thumb.webp 480w, https://storage.example.test/medium.webp 960w',
  );
  const gallery = renderToStaticMarkup(<Img {...props} variant="original" />);
  expect(gallery).toContain('src="https://storage.example.test/original.webp"');
  expect(gallery).not.toContain('srcSet=');
});
it('allows explicit native srcset and sizes', () => {
  const html = renderToStaticMarkup(
    <Img
      src="/image.webp"
      alt=""
      srcSet="/small.webp 320w, /large.webp 960w"
      sizes="50vw"
      width={960}
      height={640}
    />,
  );
  expect(html).toContain('srcSet="/small.webp 320w, /large.webp 960w"');
  expect(html).toContain('sizes="50vw"');
});
