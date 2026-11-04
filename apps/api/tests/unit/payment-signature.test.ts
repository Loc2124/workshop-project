import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  PayOSProvider,
  hasValidSignature,
} from '../../src/modules/payments/providers/payos.provider.js';

it('verifies raw payment-request values including Vietnamese text and spaces', () => {
  const data = {
    orderCode: 123,
    amount: 3000,
    desc: 'Thành công',
    code: '00',
    reference: 'TF123',
    transactionDateTime: '2023-02-04 18:25:00',
  };
  const signature = createHmac('sha256', 'test-key')
    .update(
      'amount=3000&code=00&desc=Thành công&orderCode=123&reference=TF123&transactionDateTime=2023-02-04 18:25:00',
    )
    .digest('hex');
  expect(hasValidSignature('test-key', data, signature)).toBe(true);
  expect(
    hasValidSignature('test-key', { ...data, amount: 4000 }, signature),
  ).toBe(false);
  const verified = new PayOSProvider('client', 'api', 'test-key').verifyWebhook(
    JSON.stringify({ data, signature, success: false }),
  );
  expect(verified).toMatchObject({
    signatureValid: true,
    success: true,
    amount: 3000,
  });
});

it('rejects malformed payloads and malformed signatures', () => {
  const provider = new PayOSProvider('client', 'api', 'key');
  expect(provider.verifyWebhook('{').signatureValid).toBe(false);
  expect(
    provider.verifyWebhook(
      JSON.stringify({ data: { amount: 1 }, signature: 'zz' }),
    ).signatureValid,
  ).toBe(false);
});
