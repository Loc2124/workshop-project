import { cn } from '../../lib/utils';

type Props = { availableSeats: number; className?: string };

export function SeatsBadge({ availableSeats, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[13px] font-bold tabular-nums',
        availableSeats < 1
          ? 'border-[#DDD6C4] bg-[#E8E4D8] text-[#4A453C]'
          : availableSeats <= 3
            ? 'border-[#B4532A]/40 bg-[#FCE0DB] text-[#9B2C1A]'
            : 'border-[#B8D79A] bg-[#DCEFC8] text-[#2A4710]',
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
