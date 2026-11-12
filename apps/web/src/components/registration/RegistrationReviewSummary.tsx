import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

export interface RegistrationReviewSummaryProps {
  summaryItems: Array<[string, string]>;
  onEdit: () => void;
  disabled: boolean;
}

export function RegistrationReviewSummary({
  summaryItems,
  onEdit,
  disabled,
}: RegistrationReviewSummaryProps) {
  return (
    <section
      className="rounded-xl bg-surface p-5 md:p-6"
      aria-label="Thông tin hồ sơ"
    >
      <dl className="space-y-5 break-words">
        {summaryItems.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Button
        type="button"
        variant="outline"
        className="mt-6 min-h-11"
        disabled={disabled}
        onClick={onEdit}
      >
        <ArrowLeft size={16} />
        Chỉnh sửa thông tin
      </Button>
    </section>
  );
}
