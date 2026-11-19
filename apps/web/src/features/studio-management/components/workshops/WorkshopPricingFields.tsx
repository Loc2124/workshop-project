import { StudioField } from '../StudioPrimitives';
import type { WorkshopValues } from './WorkshopEditorSheet';

interface WorkshopPricingFieldsProps {
  values: WorkshopValues;
  isOwner: boolean;
  canCollectDeposit: boolean;
  onUpdate: <K extends keyof WorkshopValues>(
    key: K,
    value: WorkshopValues[K],
  ) => void;
}

export function WorkshopPricingFields({
  values,
  isOwner,
  canCollectDeposit,
  onUpdate,
}: WorkshopPricingFieldsProps) {
  return (
    <div className="grid gap-studio-group sm:grid-cols-2">
      <StudioField
        label="Thời lượng (phút)"
        min={1}
        onChange={(event) => onUpdate('durationMinutes', event.target.value)}
        required
        step={1}
        type="number"
        value={values.durationMinutes}
      />
      {isOwner && (
        <StudioField
          label="Giá cơ sở (VND)"
          min={0}
          onChange={(event) => onUpdate('basePrice', event.target.value)}
          required
          step={1}
          type="number"
          value={values.basePrice}
        />
      )}
      {isOwner && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold">
            Cách thanh toán riêng cho workshop
            <select
              disabled={!canCollectDeposit}
              value={values.depositModeOverride}
              onChange={(event) =>
                onUpdate(
                  'depositModeOverride',
                  event.target.value as WorkshopValues['depositModeOverride'],
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
            >
              <option value="inherit">Dùng cấu hình studio</option>
              <option value="none">Không cọc</option>
              <option value="optional">Cọc tùy chọn</option>
              <option value="required">Cọc bắt buộc</option>
            </select>
          </label>
          {canCollectDeposit &&
            ['optional', 'required'].includes(values.depositModeOverride) && (
              <StudioField
                label="Mức cọc (%)"
                type="number"
                min={1}
                max={50}
                step={1}
                required
                value={values.depositPercent}
                onChange={(event) =>
                  onUpdate('depositPercent', event.target.value)
                }
              />
            )}
          {!canCollectDeposit && (
            <p className="text-sm text-studio-muted">
              Xác minh studio để bật đặt cọc.
            </p>
          )}
          {Number(values.depositPercent) > 50 && (
            <p role="alert" className="text-sm text-studio-danger">
              Mức cọc tối đa là 50%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
