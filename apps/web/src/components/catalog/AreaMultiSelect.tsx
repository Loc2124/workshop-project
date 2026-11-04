import { useEffect, useId, useState } from 'react';
import { catalogService } from '../../services/catalogService';
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
export function AreaMultiSelect({
  provinceId,
  selectedIds,
  onChange,
  onOptionsChange,
}: Props) {
  const id = useId();
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loadError, setLoadError] = useState<string>();
  useEffect(() => {
    if (!provinceId) {
      setAreas([]);
      onOptionsChange?.([]);
      setLoadError(undefined);
      return;
    }
    const controller = new AbortController();
    setAreas([]);
    setLoadError(undefined);
    catalogService
      .areas(provinceId, controller.signal)
      .then(({ areas: availableAreas }) => {
        setAreas(availableAreas);
        onOptionsChange?.(availableAreas);
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error ? error.message : 'Không tải được khu vực.',
        );
      });
    return () => controller.abort();
  }, [onOptionsChange, provinceId]);
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
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink has-checked:border-forest has-checked:bg-forest/5"
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
