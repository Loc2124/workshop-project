import { SeatsBadge } from '../catalog/SeatsBadge';

export function SeatsStamp({ seatsLeft }: { seatsLeft: number }) {
  return <SeatsBadge availableSeats={seatsLeft} />;
}
