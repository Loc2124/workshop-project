import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { startBookingExpiryJob } from './modules/bookings/booking-expiry-job.js';
import { startAttendanceJob } from './modules/bookings/attendance-job.js';
import { startFinancialObligationJob } from './modules/payments/financial-obligation-job.js';

const {
  API_PORT: port,
  TRUST_PROXY_HOPS: trustProxyHops,
  EXPIRY_JOB_INTERVAL_SECONDS: expiryJobIntervalSeconds,
} = loadConfig();
const app = createApp();

if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

startBookingExpiryJob(expiryJobIntervalSeconds);
startAttendanceJob();
startFinancialObligationJob();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
