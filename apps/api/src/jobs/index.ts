import { runExpireSeatHoldsJob } from './expire-seat-holds.job.js';
import { runSendSessionRemindersJob } from './send-session-reminders.job.js';
import { runFinancialObligationsJob } from './financial-obligations.job.js';
import { loadConfig } from '../config.js';

export function startAllJobs() {
  const { EXPIRY_JOB_INTERVAL_SECONDS } = loadConfig();
  runExpireSeatHoldsJob(EXPIRY_JOB_INTERVAL_SECONDS);
  runSendSessionRemindersJob();
  runFinancialObligationsJob();
}

export {
  runExpireSeatHoldsJob,
  runSendSessionRemindersJob,
  runFinancialObligationsJob,
};
