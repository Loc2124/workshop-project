import { stateColor, statusName } from './financialTypes';

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-medium ${stateColor(value)}`}
    >
      {statusName(value)}
    </span>
  );
}
