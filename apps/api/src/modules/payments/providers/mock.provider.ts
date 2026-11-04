import { createHash, createHmac } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatedPayment,
  PaymentProvider,
  WebhookVerification,
} from './payment-provider.js';
import { hasValidSignature } from './payos.provider.js';

export class MockProvider implements PaymentProvider {
  constructor(
    private readonly webOrigin: string,
    private readonly checksumKey: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const checkout = new URL('/payment/mock', this.webOrigin);
    checkout.searchParams.set('orderCode', String(input.orderCode));
    return { checkoutUrl: checkout.toString(), providerRef: null };
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
    const signature =
      typeof payload.signature === 'string' ? payload.signature : '';
    const data = payload.data;
    const orderCode = toInteger(data.orderCode);
    const amount = toInteger(data.amount);
    const providerRef =
      typeof data.reference === 'string' && data.reference.length > 0
        ? data.reference
        : null;
    return {
      signatureValid:
        signature.length > 0 &&
        hasValidSignature(this.checksumKey, data, signature),
      dedupeKey:
        providerRef ?? createHash('sha256').update(rawBody).digest('hex'),
      orderCode,
      amount,
      providerRef,
      success: data.code === '00' && orderCode !== null && amount !== null,
    };
  }
}

export function signMockWebhook(
  data: Record<string, unknown>,
  checksumKey: string,
): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (!isRecord(value)) return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sort(value[key])]),
    );
  };
  const canonical = Object.keys(data)
    .sort()
    .map((key) => {
      const value = sort(data[key]);
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
  return createHmac('sha256', checksumKey).update(canonical).digest('hex');
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
