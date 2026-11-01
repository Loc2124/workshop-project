import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages < 2) return null;
  const buttonClass =
    'grid size-11 place-items-center rounded-lg border border-line bg-surface text-ink hover:border-porcelain disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <nav
      aria-label="Phân trang workshop"
      className="flex items-center justify-center gap-2 py-7"
    >
      <button
        aria-label="Trang trước"
        className={buttonClass}
        disabled={page === 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        type="button"
      >
        <ChevronLeft size={18} />
      </button>
      <span
        aria-current="page"
        className="grid size-11 place-items-center rounded-lg bg-porcelain text-sm font-semibold text-white"
      >
        {page}
      </span>
      <span className="px-1 text-sm text-muted">/ {totalPages}</span>
      <button
        aria-label="Trang sau"
        className={buttonClass}
        disabled={page === totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        type="button"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
