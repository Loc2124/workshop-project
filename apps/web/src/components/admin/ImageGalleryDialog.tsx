import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
export function ImageGalleryDialog({
  images,
  index,
  onIndexChange,
  title,
}: {
  images: { id: string; url: string }[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  title: string;
}) {
  const current = Math.max(0, Math.min(index ?? 0, images.length - 1));
  const move = (direction: number) => {
    if (images.length > 1)
      onIndexChange((current + direction + images.length) % images.length);
  };
  return (
    <Dialog
      open={index !== null && images.length > 0}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null);
      }}
    >
      <DialogContent
        className="max-w-4xl rounded-md p-4"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
          }
        }}
      >
        <DialogTitle className="min-h-11 pr-12 text-sm">
          Ảnh {current + 1}/{images.length} · {title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Dùng phím mũi tên trái/phải hoặc nút điều hướng để xem ảnh tiếp theo.
        </DialogDescription>
        {images[current] && (
          <img
            src={images[current].url}
            alt={`Ảnh ${current + 1} của ${title}`}
            className="max-h-[70dvh] w-full object-contain"
          />
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={images.length < 2}
            onClick={() => move(-1)}
            aria-label="Ảnh trước"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Ảnh trước</span>
          </Button>
          <p aria-live="polite" className="text-xs text-muted">
            {current + 1} / {images.length}
          </p>
          <Button
            variant="outline"
            disabled={images.length < 2}
            onClick={() => move(1)}
            aria-label="Ảnh sau"
          >
            <span className="hidden sm:inline">Ảnh sau</span>
            <ChevronRight size={16} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
