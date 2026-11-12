import type { WorkshopValues } from './WorkshopEditorSheet';

interface WorkshopDetailFieldsProps {
  values: WorkshopValues;
  onUpdate: <K extends keyof WorkshopValues>(
    key: K,
    value: WorkshopValues[K],
  ) => void;
}

export function WorkshopDetailFields({
  values,
  onUpdate,
}: WorkshopDetailFieldsProps) {
  return (
    <div className="grid gap-studio-group sm:grid-cols-2">
      <div className="space-y-studio-field sm:col-span-2">
        <label
          htmlFor="studio-workshop-takeaway"
          className="block text-sm font-semibold text-studio-ink"
        >
          Sản phẩm mang về
        </label>
        <textarea
          id="studio-workshop-takeaway"
          className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
          maxLength={5000}
          onChange={(event) => onUpdate('takeaway', event.target.value)}
          value={values.takeaway}
        />
      </div>
      <div className="space-y-studio-field sm:col-span-2">
        <label
          htmlFor="studio-workshop-requirements"
          className="block text-sm font-semibold text-studio-ink"
        >
          Cần chuẩn bị
        </label>
        <textarea
          id="studio-workshop-requirements"
          className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
          maxLength={5000}
          onChange={(event) => onUpdate('requirements', event.target.value)}
          value={values.requirements}
        />
      </div>
    </div>
  );
}
