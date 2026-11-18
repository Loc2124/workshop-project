import { startAttendanceJob } from '../modules/bookings/attendance-job.js';

export function runSendSessionRemindersJob() {
  return startAttendanceJob();
}
