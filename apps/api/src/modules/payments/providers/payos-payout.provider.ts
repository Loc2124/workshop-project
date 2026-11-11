import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type {
  PayoutProvider,
  PayoutRequest,
  PayoutResult,
} from './payout-provider.js';

const payoutResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  desc: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      referenceId: z.string().optional(),
      status: z.string().optional(),
      amount: z.number().optional(),
      fee: z.number().optional(),
      failureReason: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

function deepSortObj(
  obj: Record<string, unknown>,
  sortArrays = false,
): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const value = obj[key];
      if (Array.isArray(value)) {
        if (sortArrays) {
          acc[key] = value
            .map((item) =>
              typeof item === 'object' && item !== null
                ? deepSortObj(item as Record<string, unknown>, sortArrays)
                : item,
            )
            .sort((a, b) => {
              if (typeof a !== 'object' && typeof b !== 'object') {
                return String(a).localeCompare(String(b));
              }
              return JSON.stringify(a).localeCompare(JSON.stringify(b));
            });
        } else {
          acc[key] = value.map((item) =>
            typeof item === 'object' && item !== null
              ? deepSortObj(item as Record<string, unknown>, sortArrays)
              : item,
          );
        }
      } else if (typeof value === 'object' && value !== null) {
        acc[key] = deepSortObj(value as Record<string, unknown>, sortArrays);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
}

export class PayOSPayoutProvider implements PayoutProvider {
  constructor(
    private readonly clientId: string,
    private readonly apiKey: string,
    private readonly checksumKey: string,
  ) {}

  signData(data: Record<string, unknown>): string {
    const sortedData = deepSortObj(data, false);
    const queryString = Object.keys(sortedData)
      .map((key) => {
        let value = sortedData[key];
        if (
          Array.isArray(value) ||
          (typeof value === 'object' && value !== null)
        ) {
          value = JSON.stringify(value);
        }
        if (value === null || value === undefined) value = '';
        return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
      })
      .join('&');
    return createHmac('sha256', this.checksumKey)
      .update(queryString)
      .digest('hex');
  }

  async executePayout(request: PayoutRequest): Promise<PayoutResult> {
    const payload: Record<string, unknown> = {
      referenceId: request.transferId,
      amount: request.amount,
      description: request.description.slice(0, 25),
      toBin: request.toBin,
      toAccountNumber: request.toAccountNumber,
    };

    const signature = this.signData(payload);

    try {
      const response = await fetch('https://api-merchant.payos.vn/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
          'x-idempotency-key': request.transferId,
          'x-signature': signature,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const body: unknown = await response.json().catch(() => null);
      const parsed = payoutResponseSchema.safeParse(body);

      if (!parsed.success) {
        return {
          status: 'failed',
          reference: `PAYOS-ERR-${Date.now()}`,
          providerFee: 0,
          failureReason: `Phản hồi payOS không hợp lệ (HTTP ${response.status})`,
        };
      }

      const resCode = String(parsed.data.code ?? '');
      const resDesc = parsed.data.desc;
      const resData = parsed.data.data;
      const remoteStatus = resData?.status?.toLowerCase();

      if (
        resCode === '00' ||
        resCode === '0' ||
        remoteStatus === 'success' ||
        remoteStatus === 'succeeded'
      ) {
        return {
          status: 'succeeded',
          reference: resData?.id ?? resData?.referenceId ?? request.transferId,
          providerFee: resData?.fee ?? 0,
        };
      }

      if (remoteStatus === 'processing' || remoteStatus === 'pending') {
        return {
          status: 'processing',
          reference: resData?.id ?? resData?.referenceId ?? request.transferId,
          providerFee: resData?.fee ?? 0,
        };
      }

      return {
        status: 'failed',
        reference: resData?.id ?? resData?.referenceId ?? `PAYOS-ERR-${Date.now()}`,
        providerFee: resData?.fee ?? 0,
        failureReason:
          resData?.failureReason ?? resDesc ?? 'Lệnh chi payOS bị từ chối.',
      };
    } catch (error) {
      return {
        status: 'processing',
        reference: request.transferId,
        providerFee: 0,
        failureReason:
          error instanceof Error
            ? error.message
            : 'Timeout khi gọi payOS Payout API.',
      };
    }
  }

  async getPayout(payoutId: string): Promise<PayoutResult> {
    try {
      const response = await fetch(
        `https://api-merchant.payos.vn/v1/payouts/${payoutId}`,
        {
          method: 'GET',
          headers: {
            'x-client-id': this.clientId,
            'x-api-key': this.apiKey,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const body: unknown = await response.json().catch(() => null);
      const parsed = payoutResponseSchema.safeParse(body);

      if (!response.ok || !parsed.success || !parsed.data.data) {
        return {
          status: 'processing',
          reference: payoutId,
          providerFee: 0,
        };
      }

      const resData = parsed.data.data;
      const remoteStatus = resData.status?.toLowerCase();

      if (remoteStatus === 'success' || remoteStatus === 'succeeded') {
        return {
          status: 'succeeded',
          reference: resData.id ?? payoutId,
          providerFee: resData.fee ?? 0,
        };
      }

      if (remoteStatus === 'failed') {
        return {
          status: 'failed',
          reference: resData.id ?? payoutId,
          providerFee: resData.fee ?? 0,
          failureReason: resData.failureReason ?? 'payOS từ chối lệnh chi.',
        };
      }

      return {
        status: 'processing',
        reference: resData.id ?? payoutId,
        providerFee: resData.fee ?? 0,
      };
    } catch {
      return {
        status: 'processing',
        reference: payoutId,
        providerFee: 0,
      };
    }
  }
}
