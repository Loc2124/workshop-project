import { useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geographyQueries } from '../../lib/geography-queries';
type Props = {
  provinceId?: string;
  selectedIds: string[];
  onChange: (areaIds: string[]) => void;
  onOptionsChange?: (areas: AreaOption[]) => void;
};
export type AreaOption = {
  id: string;
  name: string;
  studioCount: number;
};
const noAreas: AreaOption[] = [];
export function AreaMultiSelect({
  provinceId,
  selectedIds,
  onChange,
  onOptionsChange,
}: Props) {
  const id = useId();
  const query = useQuery({
    ...geographyQueries.areas(provinceId ?? ''),
    enabled: Boolean(provinceId),
  });
  const areas = provinceId ? (query.data?.areas ?? noAreas) : noAreas;
  const loadError = query.error
    ? query.error.message || 'Không tải được khu vực.'
    : undefined;
  useEffect(() => {
    onOptionsChange?.(areas);
  }, [onOptionsChange, areas]);
  if (!provinceId || (areas.length === 0 && !loadError)) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-ink">Khu vực</legend>
      {loadError && (
        <p className="text-sm font-medium text-brick">{loadError}</p>
      )}
      <div
        aria-label="Chọn một hoặc nhiều khu vực"
        className="flex max-h-28 flex-wrap gap-2 overflow-y-auto"
      >
        {areas.map((area) => {
          const checked = selectedIds.includes(area.id);
          return (
            <label
              className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink has-checked:border-forest has-checked:bg-forest/5"
              key={area.id}
            >
              <input
                checked={checked}
                className="size-4 accent-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-porcelain"
                id={`${id}-${area.id}`}
                onChange={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((selected) => selected !== area.id)
                      : [...selectedIds, area.id],
                  )
                }
                type="checkbox"
              />
              <span>
                {area.name} ({area.studioCount})
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
