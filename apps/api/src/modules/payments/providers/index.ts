import { loadConfig } from '../../../config.js';
import { MockProvider } from './mock.provider.js';
import { PayOSProvider } from './payos.provider.js';
import type { PaymentProvider } from './payment-provider.js';

export function createPaymentProvider(): PaymentProvider {
  const config = loadConfig();
  if (config.PAYMENT_PROVIDER === 'mock') {
    return new MockProvider(config.WEB_ORIGIN, config.PAYOS_CHECKSUM_KEY_TEST);
  }
  if (
    !config.PAYOS_CLIENT_ID ||
    !config.PAYOS_API_KEY ||
    !config.PAYOS_CHECKSUM_KEY
  ) {
    throw new Error('PayOS credentials are required.');
  }
  return new PayOSProvider(
    config.PAYOS_CLIENT_ID,
    config.PAYOS_API_KEY,
    config.PAYOS_CHECKSUM_KEY,
  );
}
