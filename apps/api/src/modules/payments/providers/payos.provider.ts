import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type {
  CreatePaymentInput,
  CreatedPayment,
  PaymentProvider,
  WebhookVerification,
} from './payment-provider.js';

const responseSchema = z.object({
  code: z.string(),
  desc: z.string(),
  data: z
    .object({
      checkoutUrl: z.url(),
      paymentLinkId: z.string().nullable().optional(),
      qrCode: z.string().nullable().optional(),
    })
    .optional(),
});

export class PayOSProvider implements PaymentProvider {
  constructor(
    private readonly clientId: string,
    private readonly apiKey: string,
    private readonly checksumKey: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const signature = createHmac('sha256', this.checksumKey)
      .update(
        `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`,
      )
      .digest('hex');
    const response = await fetch(
      'https://api-merchant.payos.vn/v2/payment-requests',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          orderCode: input.orderCode,
          amount: input.amount,
          description: input.description,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          buyerPhone: input.buyerPhone,
          cancelUrl: input.cancelUrl,
          returnUrl: input.returnUrl,
          signature,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body: unknown = await response.json();
    const parsed = responseSchema.safeParse(body);
    if (
      !response.ok ||
      !parsed.success ||
      parsed.data.code !== '00' ||
      !parsed.data.data
    ) {
      throw new Error('PayOS did not create a payment link.');
    }
    return {
      checkoutUrl: parsed.data.data.checkoutUrl,
      providerRef: parsed.data.data.paymentLinkId ?? null,
      qrCode: parsed.data.data.qrCode ?? null,
    };
  }

  verifyWebhook(rawBody: string): WebhookVerification {
    const fallbackKey = createHash('sha256').update(rawBody).digest('hex');
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return invalidWebhook(fallbackKey);
    }
    if (!isRecord(payload) || !isRecord(payload.data)) {
      return invalidWebhook(fallbackKey);
    }

    const { signature, data } = payload;
    const orderCode = toInteger(data.orderCode);
    const amount = toInteger(data.amount);
    const providerRef =
      typeof data.reference === 'string' && data.reference.length > 0
        ? data.reference
        : null;
    const dedupeKey =
      providerRef ?? createHash('sha256').update(rawBody).digest('hex');
    const signatureValid =
      typeof signature === 'string' &&
      hasValidSignature(this.checksumKey, data, signature);

    return {
      signatureValid,
      dedupeKey,
      orderCode,
      amount,
      providerRef,
      success: data.code === '00' && orderCode !== null && amount !== null,
    };
  }
}

export function hasValidSignature(
  checksumKey: string,
  data: Record<string, unknown>,
  signature: string,
): boolean {
  const expected = createHmac('sha256', checksumKey)
    .update(canonicalizeWebhookData(data))
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function canonicalizeWebhookData(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const value = deepSort(data[key]);
      const serialized =
        value === null ||
        value === undefined ||
        value === 'null' ||
        value === 'undefined'
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return `${key}=${serialized}`;
    })
    .join('&');
}

function deepSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSort);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, deepSort(value[key])]),
  );
}

function toInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidWebhook(dedupeKey: string): WebhookVerification {
  return {
    signatureValid: false,
    dedupeKey,
    orderCode: null,
    amount: null,
    providerRef: null,
    success: false,
  };
}
