import { createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import {
  PayOSProvider,
  hasValidSignature,
} from '../../src/modules/payments/providers/payos.provider.js';
afterEach(() => vi.unstubAllGlobals());

it('recovers only a signed payment lookup matching the requested invoice', async () => {
  const data = {
    id: 'abcdefghijklmnop',
    orderCode: 123,
    amount: 20000,
    status: 'PENDING',
  };
  const signature = createHmac('sha256', 'test-key')
    .update('amount=20000&id=abcdefghijklmnop&orderCode=123&status=PENDING')
    .digest('hex');
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify({ code: '00', data, signature }), {
        status: 200,
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const provider = new PayOSProvider('client', 'api', 'test-key');
  expect(await provider.lookupPayment(123)).toMatchObject({
    orderCode: 123,
    amount: 20000,
    status: 'PENDING',
    payment: {
      checkoutUrl: 'https://pay.payos.vn/web/abcdefghijklmnop',
      qrCode: null,
    },
  });
  await expect(provider.lookupPayment(124)).rejects.toThrow('Unable to verify');
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: '00',
        data: { ...data, amount: 30000 },
        signature,
      }),
      { status: 200 },
    ),
  );
  await expect(provider.lookupPayment(123)).rejects.toThrow('Unable to verify');
});

it('does not mistake a provider outage for a missing invoice or a successful cancellation', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);
  const provider = new PayOSProvider('client', 'api', 'test-key');
  expect(await provider.lookupPayment(123)).toBeNull();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ code: '99' }), { status: 200 }),
  );
  await expect(provider.lookupPayment(123)).rejects.toThrow();
  await expect(provider.cancelPayment(123, 'Changed seats')).rejects.toThrow();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ code: '00' }), { status: 200 }),
  );
  await expect(
    provider.cancelPayment(123, 'Changed seats'),
  ).resolves.toBeUndefined();
});

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
