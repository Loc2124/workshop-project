import { startFinancialObligationJob } from '../modules/payments/financial-obligation-job.js';

export function runFinancialObligationsJob() {
  return startFinancialObligationJob();
}
