import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cancellationRefund } from '@workshop/shared';

export type CancellationSnapshot = {
  id: string;
  userId: string;
  quantity: number;
  paidAmount: number;
  depositAmount: number;
  status: string;
  reservationStatus: string;
  startsAt: string | Date;
  endsAt: string | Date;
  sessionStatus: string;
  reschedulePending: boolean;
  scheduleVersion?: number;
  hasAttendance?: boolean;
  hasAttended?: boolean;
  selectionKey?: string;
  seats?: readonly {
    paidAmount: number;
    depositAmount: number;
    refundDueAmount: number;
    refundedAmount: number;
  }[];
};
function terms(snapshot: CancellationSnapshot, now: number) {
  const refund = cancellationRefund(
    snapshot.paidAmount,
    snapshot.startsAt,
    now,
    snapshot.reschedulePending || snapshot.sessionStatus === 'cancelled',
    snapshot.depositAmount,
  );
  const entitlements = snapshot.seats?.map((seat) => ({
    seat,
    due: Math.max(
      seat.refundDueAmount,
      cancellationRefund(
        seat.paidAmount,
        snapshot.startsAt,
        now,
        snapshot.reschedulePending || snapshot.sessionStatus === 'cancelled',
        seat.depositAmount,
      ).refundDue,
    ),
  }));
  const refundDueAmount = entitlements
    ? entitlements.reduce(
        (n, item) => n + Math.max(0, item.due - item.seat.refundedAmount),
        0,
      )
    : refund.refundDue;
  const retainedAmount = entitlements
    ? entitlements.reduce(
        (n, item) => n + Math.max(0, item.seat.paidAmount - item.due),
        0,
      )
    : snapshot.paidAmount - refundDueAmount;
  const alreadyRefundedAmount =
    entitlements?.reduce((n, item) => n + item.seat.refundedAmount, 0) ?? 0;
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        snapshot.id,
        snapshot.userId,
        snapshot.quantity,
        snapshot.paidAmount,
        snapshot.depositAmount,
        snapshot.status,
        snapshot.reservationStatus,
        new Date(snapshot.startsAt).toISOString(),
        new Date(snapshot.endsAt).toISOString(),
        snapshot.sessionStatus,
        snapshot.reschedulePending,
        snapshot.scheduleVersion,
        Boolean(snapshot.hasAttendance),
        Boolean(snapshot.hasAttended),
        snapshot.selectionKey,
        snapshot.seats,
        refundDueAmount,
        retainedAmount,
      ]),
    )
    .digest('hex');
  return {
    refundDueAmount,
    retainedAmount,
    paidAmount: snapshot.paidAmount,
    alreadyRefundedAmount,
    fingerprint,
  };
}
const signature = (body: string, secret: string) =>
  createHmac('sha256', secret)
    .update('cancellation-quote-v1.' + body)
    .digest();
export function createCancellationQuote(
  snapshot: CancellationSnapshot,
  now: number,
  secret: string,
) {
  const { fingerprint, ...amounts } = terms(snapshot, now);
  const expiresAt = now + 5 * 60000;
  const body = Buffer.from(JSON.stringify({ fingerprint, expiresAt })).toString(
    'base64url',
  );
  return {
    ...amounts,
    quoteToken: body + '.' + signature(body, secret).toString('base64url'),
    expiresAt: new Date(expiresAt).toISOString(),
    serverNow: new Date(now).toISOString(),
  };
}
export function cancellationQuoteMatches(
  token: string,
  snapshot: CancellationSnapshot,
  now: number,
  secret: string,
) {
  try {
    if (token.length > 2000) return false;
    const [body, sig, extra] = token.split('.');
    if (!body || !sig || extra) return false;
    const expected = signature(body, secret),
      actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return (
      typeof value.expiresAt === 'number' &&
      now < value.expiresAt &&
      value.fingerprint === terms(snapshot, now).fingerprint
    );
  } catch {
    return false;
  }
}
