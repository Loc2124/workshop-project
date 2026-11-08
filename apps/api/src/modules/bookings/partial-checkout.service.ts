import { query, withTransaction } from '../../db/pool.js';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { releaseExpiredHolds } from './bookings.repository.js';
import { createPaymentProvider } from '../payments/providers/index.js';
import type { CreatedPayment } from '../payments/providers/payment-provider.js';

type Attempt = {
  id: string;
  bookingId: string;
  provider: 'mock' | 'payos';
  orderCode: number;
  amount: number;
  revision: number;
  setup: string;
  expiresAt: Date;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  recover: boolean;
};
export async function refreshPartialCheckout(
  userId: string,
  bookingId: string,
) {
  const claim = await withTransaction(async (client) => {
    const target = (
      await client.query<{ sessionId: string }>(
        'SELECT session_id AS "sessionId" FROM bookings WHERE id=$1 AND user_id=$2',
        [bookingId, userId],
      )
    ).rows[0];
    if (!target)
      return {
        error: new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.'),
      };
    await releaseExpiredHolds(client, [target.sessionId]);
    const eligible = await client.query(
      `SELECT b.id FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id
   WHERE b.id=$1 AND b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>clock_timestamp() AND b.seat_revision>0
    AND s.status='scheduled' AND s.starts_at>clock_timestamp() AND COALESCE(s.registration_deadline,s.starts_at)>clock_timestamp()
    AND w.status='approved' AND NOT w.is_simulated AND NOT w.is_discontinued AND w.visibility_status='active' AND w.publication_status='published'
    AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st) FOR UPDATE OF b`,
      [bookingId],
    );
    if (!eligible.rowCount) return { state: 'unavailable' as const };
    const attempt = (
      await client.query<Attempt & { recent: boolean }>(
        `SELECT p.id,b.id AS "bookingId",p.provider,p.order_code::integer AS "orderCode",p.amount,p.checkout_revision AS revision,p.checkout_setup AS setup,
   b.hold_expires_at AS "expiresAt",COALESCE(b.contact_name,u.full_name) AS "buyerName",u.email AS "buyerEmail",COALESCE(b.contact_phone,u.phone,'') AS "buyerPhone",
   (p.checkout_claimed_at>clock_timestamp()-interval '30 seconds') AS recent FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN users u ON u.id=b.user_id
   WHERE b.id=$1 AND p.kind='deposit' AND p.checkout_revision=b.checkout_revision AND p.status='created' FOR UPDATE OF p`,
        [bookingId],
      )
    ).rows[0];
    if (!attempt) return { state: 'unavailable' as const };
    if (attempt.setup === 'ready') return { state: 'ready' as const };
    if (attempt.setup === 'creating' && attempt.recent)
      return { state: 'creating' as const };
    await client.query(
      "UPDATE payments SET checkout_setup='creating',checkout_claimed_at=clock_timestamp() WHERE id=$1",
      [attempt.id],
    );
    return { attempt: { ...attempt, recover: attempt.setup !== 'pending' } };
  });
  if ('error' in claim) throw claim.error;
  if (!('attempt' in claim)) return { checkoutState: claim.state };
  const attempt = claim.attempt!,
    config = loadConfig();
  try {
    const provider = createPaymentProvider(attempt.provider);
    let payment: CreatedPayment | undefined;
    if (attempt.recover) {
      if (!provider.lookupPayment)
        throw new Error('Payment lookup is unavailable.');
      const existing = await provider.lookupPayment(attempt.orderCode);
      if (existing) {
        if (
          existing.orderCode !== attempt.orderCode ||
          existing.amount !== attempt.amount
        )
          throw new Error('Recovered checkout terms do not match.');
        if (existing.status !== 'PENDING') {
          await query(
            "UPDATE payments SET checkout_setup='unknown' WHERE id=$1 AND status='created'",
            [attempt.id],
          );
          return {
            checkoutState:
              existing.status === 'PAID'
                ? ('awaiting_confirmation' as const)
                : ('unavailable' as const),
          };
        }
        payment = existing.payment;
      }
    }
    if (!payment) {
      if (Date.now() >= attempt.expiresAt.getTime())
        return { checkoutState: 'unavailable' as const };
      const returnUrl = new URL(config.PAYOS_RETURN_URL),
        cancelUrl = new URL(config.PAYOS_CANCEL_URL);
      returnUrl.searchParams.set('bookingId', bookingId);
      cancelUrl.searchParams.set('bookingId', bookingId);
      payment = await provider.createPayment({
        orderCode: attempt.orderCode,
        amount: attempt.amount,
        description: String(attempt.orderCode),
        expiresAt: attempt.expiresAt.toISOString(),
        buyerName: attempt.buyerName,
        buyerEmail: attempt.buyerEmail,
        buyerPhone: attempt.buyerPhone,
        returnUrl: returnUrl.toString(),
        cancelUrl: cancelUrl.toString(),
      });
    }
    const saved = await query(
      `UPDATE payments p SET checkout_url=$2,provider_ref=$3,qr_code=$4,transfer_description=$5,checkout_setup='ready' FROM bookings b JOIN sessions s ON s.id=b.session_id
    WHERE p.id=$1 AND b.id=p.booking_id AND p.status='created' AND p.checkout_revision=b.checkout_revision AND b.reservation_status='pending' AND b.status='pending' AND b.hold_expires_at>clock_timestamp()
      AND s.status='scheduled' AND s.starts_at>clock_timestamp() AND COALESCE(s.registration_deadline,s.starts_at)>clock_timestamp() RETURNING p.id`,
      [
        attempt.id,
        payment.checkoutUrl,
        payment.providerRef,
        payment.qrCode,
        payment.transferDescription ?? String(attempt.orderCode),
      ],
    );
    if (!saved.rowCount) return { checkoutState: 'unavailable' as const };
    const old = (
      await query<{ orderCode: number }>(
        "SELECT order_code::integer AS \"orderCode\" FROM payments WHERE booking_id=$1 AND kind='deposit' AND checkout_revision=$2 AND status='cancelled'",
        [bookingId, attempt.revision - 1],
      )
    ).rows;
    for (const previous of old) {
      try {
        await provider.cancelPayment?.(
          previous.orderCode,
          'Khách thay đổi số chỗ giữ.',
        );
      } catch {
        /* Bank transfers to an obsolete code are still reconciled by webhook. */
      }
    }
    return { checkoutState: 'ready' as const };
  } catch {
    await query(
      "UPDATE payments SET checkout_setup='unknown' WHERE id=$1 AND status='created' AND checkout_setup='creating'",
      [attempt.id],
    );
    return { checkoutState: 'unknown' as const };
  }
}
