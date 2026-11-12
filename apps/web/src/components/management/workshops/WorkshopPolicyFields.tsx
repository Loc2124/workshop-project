import type { WorkshopValues } from './WorkshopEditorSheet';

interface WorkshopPolicyFieldsProps {
  values: WorkshopValues;
  hasExistingWorkshop: boolean;
  onUpdate: <K extends keyof WorkshopValues>(
    key: K,
    value: WorkshopValues[K],
  ) => void;
}

export function WorkshopPolicyFields({
  values,
  hasExistingWorkshop,
  onUpdate,
}: WorkshopPolicyFieldsProps) {
  return (
    <div className="grid gap-studio-group sm:grid-cols-2">
      <div className="space-y-studio-field">
        <label
          htmlFor="studio-workshop-cancellation-policy"
          className="block text-sm font-semibold text-studio-ink"
        >
          Chính sách hủy
        </label>
        <textarea
          id="studio-workshop-cancellation-policy"
          className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
          maxLength={5000}
          onChange={(event) =>
            onUpdate('cancellationPolicy', event.target.value)
          }
          value={values.cancellationPolicy}
        />
      </div>
      <div className="space-y-studio-field">
        <label
          htmlFor="studio-workshop-payment-policy"
          className="block text-sm font-semibold text-studio-ink"
        >
          Chính sách thanh toán
        </label>
        <textarea
          id="studio-workshop-payment-policy"
          className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
          maxLength={5000}
          onChange={(event) => onUpdate('paymentPolicy', event.target.value)}
          value={values.paymentPolicy}
        />
      </div>
      <div className="space-y-studio-field sm:col-span-2">
        <label
          htmlFor="studio-workshop-publication-status"
          className="block text-sm font-semibold text-studio-ink"
        >
          Hiển thị workshop
        </label>
        <select
          id="studio-workshop-publication-status"
          className="min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 sm:max-w-xs"
          value={values.publicationStatus}
          onChange={(event) =>
            onUpdate(
              'publicationStatus',
              event.target.value as 'draft' | 'published',
            )
          }
        >
          <option value="draft">Bản nháp</option>
          <option value="published">Công khai</option>
        </select>
      </div>
      {hasExistingWorkshop && (
        <label className="flex items-center gap-3 text-sm font-semibold text-studio-ink sm:col-span-2 min-h-11">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={values.isDiscontinued}
            onChange={(event) =>
              onUpdate('isDiscontinued', event.target.checked)
            }
          />
          Đã ngừng tổ chức workshop này
        </label>
      )}
    </div>
  );
}
