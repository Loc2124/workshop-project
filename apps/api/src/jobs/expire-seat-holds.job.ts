import { startBookingExpiryJob } from '../modules/bookings/booking-expiry-job.js';

export function runExpireSeatHoldsJob(intervalSeconds: number = 60) {
  return startBookingExpiryJob(intervalSeconds);
}
