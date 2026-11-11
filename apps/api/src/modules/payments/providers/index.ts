import { loadConfig } from '../../../config.js';
import { MockProvider } from './mock.provider.js';
import { PayOSProvider } from './payos.provider.js';
import type { PaymentProvider } from './payment-provider.js';
import type { PayoutProvider } from './payout-provider.js';
import { ManualPayoutProvider } from './manual-payout.provider.js';
import { MockPayoutProvider } from './mock-payout.provider.js';
import { PayOSPayoutProvider } from './payos-payout.provider.js';

export * from './payout-provider.js';

export function createPaymentProvider(
  name?: 'mock' | 'payos',
): PaymentProvider {
  const config = loadConfig();
  if ((name ?? config.PAYMENT_PROVIDER) === 'mock') {
    if (config.NODE_ENV === 'production')
      throw new Error('Mock payments are disabled in production.');
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

export function createPayoutProvider(
  name?: 'manual' | 'mock' | 'payos',
): PayoutProvider {
  const config = loadConfig();
  const provider = name ?? config.PAYOUT_PROVIDER;
  if (provider === 'mock') {
    return new MockPayoutProvider();
  }
  if (provider === 'payos') {
    if (
      !config.PAYOS_PAYOUT_CLIENT_ID ||
      !config.PAYOS_PAYOUT_API_KEY ||
      !config.PAYOS_PAYOUT_CHECKSUM_KEY
    ) {
      throw new Error('PayOS Payout credentials are required.');
    }
    return new PayOSPayoutProvider(
      config.PAYOS_PAYOUT_CLIENT_ID,
      config.PAYOS_PAYOUT_API_KEY,
      config.PAYOS_PAYOUT_CHECKSUM_KEY,
    );
  }
  return new ManualPayoutProvider();
}
