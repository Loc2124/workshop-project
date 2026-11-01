export type CatalogView = 'workshops' | 'studios';

type Props = {
  value: CatalogView;
  onChange: (view: CatalogView) => void;
};

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div
      aria-label="Chế độ xem kết quả"
      className="inline-flex min-h-11 min-w-28 shrink-0 rounded-lg border border-line bg-surface p-1"
      role="group"
    >
      {(
        [
          ['studios', 'Xưởng'],
          ['workshops', 'Workshop'],
        ] as const
      ).map(([view, label]) => (
        <button
          aria-pressed={value === view}
          className={`min-h-11 min-w-20 rounded-lg px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain lg:min-w-28 lg:px-3 ${
            value === view ? 'bg-forest text-white' : 'text-ink hover:bg-paper'
          }`}
          key={view}
          onClick={() => onChange(view)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
