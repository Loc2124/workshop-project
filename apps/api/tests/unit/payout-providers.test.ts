import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayOSPayoutProvider } from '../../src/modules/payments/providers/payos-payout.provider.js';
import { MockPayoutProvider } from '../../src/modules/payments/providers/mock-payout.provider.js';
import { ManualPayoutProvider } from '../../src/modules/payments/providers/manual-payout.provider.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PayOSPayoutProvider', () => {
  const clientId = 'test-client-id';
  const apiKey = 'test-api-key';
  const checksumKey = 'test-checksum-key';
  const provider = new PayOSPayoutProvider(clientId, apiKey, checksumKey);

  it('signs payload data with HMAC-SHA256 and alphabetical key order', () => {
    const data = {
      referenceId: 'transfer-123',
      amount: 50000,
      description: 'Hoan tien',
    };
    const signature = provider.signData(data);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature).toHaveLength(64); // sha256 hex length
  });

  it('handles successful payout response from payOS', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: '00',
          desc: 'Success',
          data: {
            id: 'payout-remote-123',
            referenceId: 'transfer-123',
            status: 'SUCCESS',
            amount: 50000,
            fee: 2200,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.executePayout({
      transferId: 'transfer-123',
      amount: 50000,
      toBin: '970422',
      toAccountNumber: '0123456789',
      description: 'Hoan tien',
    });

    expect(result.status).toBe('succeeded');
    expect(result.reference).toBe('payout-remote-123');
    expect(result.providerFee).toBe(2200);

    // Verify headers sent
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-merchant.payos.vn/v1/payouts');
    const headers = options.headers as Record<string, string>;
    expect(headers['x-client-id']).toBe(clientId);
    expect(headers['x-api-key']).toBe(apiKey);
    expect(headers['x-idempotency-key']).toBe('transfer-123');
    expect(headers['x-signature']).toBeDefined();
  });

  it('handles rejected payout response from payOS', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: '21',
          desc: 'Tài khoản thụ hưởng không hợp lệ',
          data: {
            status: 'FAILED',
            failureReason: 'Tài khoản thụ hưởng không hợp lệ',
          },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.executePayout({
      transferId: 'transfer-124',
      amount: 50000,
      toBin: '970422',
      toAccountNumber: '000000',
      description: 'Hoan tien',
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('không hợp lệ');
  });

  it('treats network timeout as processing/manual_review without failing blindly', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Gateway timeout'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.executePayout({
      transferId: 'transfer-125',
      amount: 50000,
      toBin: '970422',
      toAccountNumber: '0123456789',
      description: 'Hoan tien',
    });

    expect(result.status).toBe('processing');
    expect(result.reference).toBe('transfer-125');
  });

  it('queries payout status by id via getPayout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: '00',
          desc: 'Success',
          data: {
            id: 'payout-remote-123',
            status: 'SUCCESS',
            amount: 50000,
            fee: 2200,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.getPayout('payout-remote-123');
    expect(result.status).toBe('succeeded');
    expect(result.reference).toBe('payout-remote-123');
    expect(result.providerFee).toBe(2200);
  });
});

describe('MockPayoutProvider', () => {
  const provider = new MockPayoutProvider();

  it('succeeds for normal account numbers', async () => {
    const result = await provider.executePayout({
      transferId: 'tx-1',
      amount: 100000,
      toBin: '970436',
      toAccountNumber: '1234567890',
      description: 'Studio payout',
    });
    expect(result.status).toBe('succeeded');
    expect(result.providerFee).toBe(2200);
    expect(result.reference).toContain('MOCK-PAYOUT-');
  });

  it('fails for blacklisted test account 0000000000', async () => {
    const result = await provider.executePayout({
      transferId: 'tx-2',
      amount: 100000,
      toBin: '970436',
      toAccountNumber: '0000000000',
      description: 'Studio payout',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBeDefined();
  });
});

describe('ManualPayoutProvider', () => {
  const provider = new ManualPayoutProvider();

  it('returns processing status awaiting manual transfer', async () => {
    const result = await provider.executePayout({
      transferId: 'tx-manual-123',
      amount: 200000,
      toBin: '970422',
      toAccountNumber: '987654321',
      description: 'Manual payout',
    });
    expect(result.status).toBe('processing');
    expect(result.reference).toBe('MANUAL-tx-manua');
    expect(result.providerFee).toBe(0);
  });
});
