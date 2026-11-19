import { SeatsBadge } from '@/features/catalog/components/SeatsBadge';

export function SeatsStamp({ seatsLeft }: { seatsLeft: number }) {
  return <SeatsBadge availableSeats={seatsLeft} />;
}
