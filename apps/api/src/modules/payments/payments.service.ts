import { AppError } from '../../errors/app-error.js';
import { loadConfig } from '../../config.js';
import {
  createMockWebhook,
  confirmInStudioPayment as recordInStudioPayment,
  processPaymentWebhook,
} from './payments.repository.js';
import { createPaymentProvider } from './providers/index.js';
import { queuePaidBookingEmail } from '../../services/booking-emails.js';

export async function confirmStudioPayment(
  studioId: string,
  userId: string,
  bookingId: string,
  expectedAmount: number,
) {
  const result = await recordInStudioPayment(
    studioId,
    userId,
    bookingId,
    expectedAmount,
  );
  if (result === 'not_found') return 'not_found';
  if (result === 'conflict') return 'conflict';
  return 'confirmed';
}

export async function receivePaymentWebhook(
  providerName: 'payos' | 'mock',
  rawBody: string,
) {
  const config = loadConfig();
  if (
    providerName !== config.PAYMENT_PROVIDER ||
    (providerName === 'mock' && config.NODE_ENV === 'production')
  ) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy webhook.');
  }
  const provider = createPaymentProvider();
  const verification = provider.verifyWebhook(rawBody);
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = rawBody;
  }
  const result = await processPaymentWebhook(
    providerName,
    verification,
    payload,
  );
  if (verification.signatureValid && verification.success && verification.orderCode !== null)
    queuePaidBookingEmail(String(verification.orderCode));
  return { ...verification, result };
}

export async function confirmMockPayment(
  userId: string,
  orderCodeValue: string,
) {
  const config = loadConfig();
  if (config.NODE_ENV === 'production' || config.PAYMENT_PROVIDER !== 'mock') {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán mô phỏng.');
  }
  const orderCode = Number(orderCodeValue);
  if (
    !/^\d{1,9}$/.test(orderCodeValue) ||
    !Number.isSafeInteger(orderCode) ||
    orderCode < 100_000_000 ||
    orderCode > 999_999_999
  ) {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Mã thanh toán không hợp lệ.',
    );
  }
  const rawBody = await createMockWebhook(
    userId,
    orderCode,
    config.PAYOS_CHECKSUM_KEY_TEST,
  );
  if (!rawBody) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
  }
  const provider = createPaymentProvider();
  const verification = provider.verifyWebhook(rawBody);
  await processPaymentWebhook('mock', verification, JSON.parse(rawBody));
  return { ok: true };
}
