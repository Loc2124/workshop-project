import { lazy, Suspense, useState } from 'react';
import { Img } from '../ui/Img';
import { imageSources } from '../../lib/image-sources';
const Gallery = lazy(() =>
  import('../admin/ImageGalleryDialog').then((module) => ({
    default: module.ImageGalleryDialog,
  })),
);
export function StudioPhotoGrid({
  name,
  urls,
  images = [],
}: {
  name: string;
  urls: string[];
  images?: { url: string; thumbnailUrl?: string; mediumUrl?: string }[];
}) {
  const [index, setIndex] = useState<number | null>(null);
  const photos = urls.map((url, i) => ({
    id: String(i),
    url: imageSources(url, 'original').src ?? url,
  }));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {urls.map((url, i) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              setIndex(i);
            }}
          >
            <Img
              src={url}
              variant="thumbnail"
              thumbnailUrl={
                images.find((image) => image.url === url)?.thumbnailUrl
              }
              alt={`Không gian ${name}, ảnh ${i + 1}`}
              className="aspect-4/3 w-full rounded-lg object-cover"
            />
          </a>
        ))}
      </div>
      {index !== null && (
        <Suspense fallback={null}>
          <Gallery
            images={photos}
            index={index}
            onIndexChange={setIndex}
            title={name}
          />
        </Suspense>
      )}
    </>
  );
}
