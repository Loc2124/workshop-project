import { SeatsBadge } from '@/features/catalog';

export function SeatsStamp({ seatsLeft }: { seatsLeft: number }) {
  return <SeatsBadge availableSeats={seatsLeft} />;
}
