import { AppError } from '../../errors/app-error.js';
import { loadConfig } from '../../config.js';
import { query } from '../../db/pool.js';
import {
  createCustomerBooking as insertCustomerBooking,
  failCheckout,
  getCustomerBooking as selectCustomerBooking,
  getCustomerTickets as selectCustomerTickets,
  listCustomerBookings as selectCustomerBookings,
  saveCheckoutLink,
  type CreateCustomerBookingInput,
} from './bookings.repository.js';
import { cancelCustomerBooking as cancelOwnedBooking } from '../payments/payments.repository.js';
import { createPaymentProvider } from '../payments/providers/index.js';
import type { CreatedPayment } from '../payments/providers/payment-provider.js';

export async function createCustomerBooking(
  userId: string,
  input: Pick<CreateCustomerBookingInput, 'sessionId' | 'quantity'>,
) {
  const user = await query<{
    email: string;
    fullName: string;
    phone: string | null;
  }>('SELECT email, full_name AS "fullName", phone FROM users WHERE id = $1', [
    userId,
  ]);
  const customer = user.rows[0];
  if (!customer) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập lại.');
  }
  const contact = {
    contactName: customer.fullName,
    contactPhone: customer.phone?.trim() || null,
  };
  const config = loadConfig();
  const result = await insertCustomerBooking(
    userId,
    { sessionId: input.sessionId, quantity: input.quantity, ...contact },
    config.HOLD_MINUTES,
    config.PAYMENT_PROVIDER,
  );
  if (result.kind === 'not_found') {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy buổi còn nhận đặt chỗ.',
    );
  }
  if (result.kind === 'unavailable') {
    throw new AppError(
      409,
      'CONFLICT',
      'Buổi vừa hết chỗ. Vui lòng tải lại và chọn buổi khác.',
    );
  }
  if (result.kind === 'invalid_amount') {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Tổng tiền vượt giới hạn hỗ trợ.',
    );
  }
  if (!result.booking.checkoutRequired) {
    return { booking: result.booking, checkoutUrl: null };
  }

  const returnUrl = new URL(config.PAYOS_RETURN_URL);
  returnUrl.searchParams.set('bookingId', result.booking.id);
  const cancelUrl = new URL(config.PAYOS_CANCEL_URL);
  cancelUrl.searchParams.set('bookingId', result.booking.id);
  const provider = createPaymentProvider();
  let payment: CreatedPayment;
  try {
    payment = await provider.createPayment({
      orderCode: result.booking.orderCode,
      amount: result.booking.depositAmount,
      description: String(result.booking.orderCode),
      buyerName: contact.contactName,
      buyerEmail: customer.email,
      buyerPhone: contact.contactPhone ?? '',
      returnUrl: returnUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });
  } catch {
    await failCheckout(result.booking.id);
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Chưa tạo được liên kết thanh toán. Chỗ giữ đã được giải phóng; vui lòng thử lại.',
    );
  }
  try {
    await saveCheckoutLink(
      result.booking.id,
      config.PAYMENT_PROVIDER,
      payment.checkoutUrl,
      payment.providerRef,
      payment.qrCode,
    );
  } catch {
    await failCheckout(result.booking.id);
    throw new Error('Unable to persist the PayOS checkout link.');
  }
  return {
    booking: result.booking,
    checkoutUrl: payment.checkoutUrl,
    checkoutQrCode: payment.qrCode,
  };
}

export async function getBookingForCustomer(userId: string, bookingId: string) {
  const booking = await selectCustomerBooking(userId, bookingId);
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
  }
  return { booking };
}

export async function getBookingsForCustomer(userId: string) {
  return { bookings: await selectCustomerBookings(userId) };
}

export async function getTicketsForCustomer(userId: string, bookingId: string) {
  const result = await selectCustomerTickets(userId, bookingId);
  if (!result) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé.');
  }
  return result;
}

export async function cancelBookingForCustomer(
  userId: string,
  bookingId: string,
) {
  const result = await cancelOwnedBooking(bookingId, userId);
  if (result === 'not_found') {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
  }
  if (result === 'conflict') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể hủy đơn ở trạng thái hiện tại hoặc đã quá hạn hủy.',
    );
  }
  return { ok: true };
}
