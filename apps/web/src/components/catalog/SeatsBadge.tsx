import { cn } from '../../lib/utils';

type Props = { availableSeats: number; className?: string };

export function SeatsBadge({ availableSeats, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[13px] font-bold tabular-nums',
        availableSeats <= 3
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-green-300 bg-green-50 text-green-800',
        className,
      )}
    >
      {availableSeats < 1
        ? 'Hết chỗ'
        : availableSeats <= 3
          ? `Chỉ còn ${availableSeats} chỗ`
          : `Còn ${availableSeats} chỗ`}
    </span>
  );
}
