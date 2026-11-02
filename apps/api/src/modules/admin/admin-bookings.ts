import { adminListFields } from './admin-list-query.js';
import { z } from 'zod';
import { getSiteSettings } from '../settings/settings.repository.js';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
const status = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);
const date = z.iso.date();
export const adminBookingsQuery = z
  .object({
    ...adminListFields,
    status: z
      .enum(['all', 'pending', 'confirmed', 'cancelled', 'completed'])
      .default('all'),
    studioId: z.string().uuid().optional(),
    dateFrom: date.optional(),
    dateTo: date.optional(),
    period: z.enum(['today', '7d']).optional(),
    sort: z
      .enum([
        'code:asc',
        'code:desc',
        'customerName:asc',
        'customerName:desc',
        'workshopTitle:asc',
        'workshopTitle:desc',
        'studioName:asc',
        'studioName:desc',
        'startsAt:asc',
        'startsAt:desc',
        'quantity:asc',
        'quantity:desc',
        'totalAmount:asc',
        'totalAmount:desc',
        'status:asc',
        'status:desc',
        'createdAt:asc',
        'createdAt:desc',
      ])
      .default('createdAt:desc'),
  })
  .strict()
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  });
export const adminBookingDecision = z
  .object({
    status,
    expectedStatus: status,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
const joins =
  'FROM bookings b JOIN users u ON u.id=b.user_id JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id';
const columns = `b.id,b.order_code::text AS code,u.full_name AS "customerName",u.email AS "customerEmail",u.phone AS "customerPhone",w.id AS "workshopId",w.title AS "workshopTitle",w.description AS "workshopDescription",st.id AS "studioId",st.name AS "studioName",st.address,s.id AS "sessionId",s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.status AS "slotStatus",b.quantity,b.unit_price AS "unitPrice",b.total_amount AS "totalAmount",b.reservation_status AS status,b.status AS "paymentStatus",b.created_at AS "createdAt",b.hold_expires_at AS "holdExpiresAt"`;
export async function listAdminBookings(
  filters: z.infer<typeof adminBookingsQuery>,
  countsOnly = false,
) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const clauses = ['true'];
  if (filters.q) {
    const p = bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%');
    clauses.push(
      `(b.order_code::text ILIKE ${p} OR b.id::text ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR u.phone ILIKE ${p})`,
    );
  }
  if (filters.studioId) clauses.push(`st.id=${bind(filters.studioId)}`);
  if (filters.dateFrom)
    clauses.push(
      `s.starts_at>=${bind(filters.dateFrom)}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
    );
  if (filters.dateTo)
    clauses.push(
      `s.starts_at<(${bind(filters.dateTo)}::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
    );
  if (filters.period === 'today')
    clauses.push(
      "b.created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AND b.created_at<(date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 day') AT TIME ZONE 'Asia/Ho_Chi_Minh'",
    );
  if (filters.period === '7d')
    clauses.push("b.created_at>=now()-interval '7 days'");
  const counts = await query<{ status: string; count: number }>(
    `SELECT b.reservation_status AS status,count(*)::int AS count ${joins} WHERE ${clauses.join(' AND ')} GROUP BY b.reservation_status`,
    values,
  );
  const statusCounts: Record<string, number> = {
    all: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
  };
  for (const r of counts.rows) {
    statusCounts[r.status] = r.count;
    statusCounts.all += r.count;
  }
  if (countsOnly)
    return { rows: [], total: statusCounts.all, statusCounts: statusCounts };
  if (filters.status !== 'all')
    clauses.push(`b.reservation_status=${bind(filters.status)}`);
  const sorts: Record<string, string> = {
    code: 'b.order_code',
    customerName: 'u.full_name',
    workshopTitle: 'w.title',
    studioName: 'st.name',
    startsAt: 's.starts_at',
    quantity: 'b.quantity',
    totalAmount: 'b.total_amount',
    status: 'b.reservation_status',
    createdAt: 'b.created_at',
  };
  const [field, direction] = filters.sort.split(':');
  const result = await query(
    `SELECT ${columns} ${joins} WHERE ${clauses.join(' AND ')} ORDER BY ${sorts[field]} ${direction === 'asc' ? 'ASC' : 'DESC'},b.id LIMIT ${bind(filters.pageSize)} OFFSET ${bind((filters.page - 1) * filters.pageSize)}`,
    values,
  );
  return {
    rows: result.rows,
    total: statusCounts[filters.status],
    statusCounts,
  };
}
export async function getAdminBooking(id: string) {
  const booking = (
    await query(`SELECT ${columns} ${joins} WHERE b.id=$1`, [id])
  ).rows[0];
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
  const history = (
    await query(
      `SELECT id::text,from_status AS "fromStatus",to_status AS "toStatus",previous_payment_status AS "previousPaymentStatus",payment_status AS "paymentStatus",actor_id AS "actorId",actor_name AS "actorName",reason,created_at AS "createdAt" FROM booking_status_history WHERE booking_id=$1 ORDER BY created_at,id`,
      [id],
    )
  ).rows;
  return { booking: { ...booking, history } };
}
export async function changeAdminBooking(
  id: string,
  actor: string,
  input: z.infer<typeof adminBookingDecision>,
  customerId?: string,
) {
  await withTransaction(async (client) => {
    const lookup = (
      await client.query<{ session_id: string }>(
        'SELECT session_id FROM bookings WHERE id=$1 AND ($2::uuid IS NULL OR user_id=$2)',
        [id, customerId ?? null],
      )
    ).rows[0];
    if (!lookup)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
    // Match hold-expiry/session-cancellation lock order: session before booking.
    const slot = (
      await client.query<{ status: string; ended: boolean; startsAt: Date }>(
        'SELECT status,ends_at<=now() AS ended,starts_at AS "startsAt" FROM sessions WHERE id=$1 FOR UPDATE',
        [lookup.session_id],
      )
    ).rows[0];
    if (customerId) {
      const policy = (await getSiteSettings(client)).booking;
      if (input.status !== 'cancelled')
        throw new AppError(
          403,
          'FORBIDDEN',
          'Chỉ được hủy đặt chỗ của chính bạn.',
        );
      const allowed = (
        await client.query<{ ok: boolean }>(
          'SELECT $1::timestamptz>clock_timestamp()+make_interval(hours=>$2) AS ok',
          [slot.startsAt, policy.cancellationHours],
        )
      ).rows[0];
      if (!allowed?.ok)
        throw new AppError(
          400,
          'BAD_REQUEST',
          `Chỉ được hủy trước giờ học ít nhất ${policy.cancellationHours} giờ.`,
        );
    }
    const b = (
      await client.query<{
        session_id: string;
        status: string;
        reservation_status: string;
        quantity: number;
        expired: boolean;
      }>(
        'SELECT session_id,status,reservation_status,quantity,hold_expires_at<=now() AS expired FROM bookings WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (b.session_id !== lookup.session_id)
      throw new AppError(
        409,
        'CONFLICT',
        'Slot đã thay đổi. Vui lòng tải lại.',
      );
    if (b.reservation_status !== input.expectedStatus)
      throw new AppError(
        409,
        'CONFLICT',
        'Trạng thái đã thay đổi. Vui lòng tải lại đặt chỗ.',
      );
    const allowed: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
    };
    if (!allowed[b.reservation_status]?.includes(input.status))
      throw new AppError(
        409,
        'CONFLICT',
        'Không thể chuyển sang trạng thái này.',
      );
    if (
      input.status !== 'cancelled' &&
      (slot.status === 'cancelled' ||
        b.status === 'expired' ||
        b.status === 'refund_needed' ||
        b.status === 'cancelled')
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Đặt chỗ hoặc slot không còn hiệu lực.',
      );
    if (input.status === 'confirmed' && b.status === 'pending' && b.expired)
      throw new AppError(
        409,
        'CONFLICT',
        'Thời gian giữ chỗ đã hết. Không thể xác nhận.',
      );
    if (input.status === 'completed' && !slot.ended)
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Chỉ hoàn tất sau khi slot kết thúc.',
      );
    if (input.status === 'cancelled') {
      const counter =
        b.status === 'pending'
          ? 'seats_held'
          : b.status === 'paid'
            ? 'seats_sold'
            : null;
      if (counter) {
        const released = await client.query(
          `UPDATE sessions SET ${counter}=${counter}-$2 WHERE id=$1 AND ${counter}>=$2 RETURNING id`,
          [b.session_id, b.quantity],
        );
        if (!released.rowCount)
          throw new AppError(
            409,
            'CONFLICT',
            'Số chỗ không khớp. Chưa hủy đặt chỗ.',
          );
      }
      await client.query(
        "UPDATE tickets SET status='void' WHERE booking_id=$1 AND status='valid'",
        [id],
      );
    }
    await client.query(
      "SELECT set_config('app.booking_actor',$1,true),set_config('app.booking_reason',$2,true)",
      [actor, input.reason],
    );
    await client.query(
      `UPDATE bookings SET reservation_status=$2,status=CASE WHEN $2='cancelled' AND status='paid' THEN 'refund_needed'::booking_status WHEN $2='cancelled' THEN 'cancelled'::booking_status ELSE status END WHERE id=$1`,
      [id, input.status],
    );
  });
  return customerId ? { ok: true } : getAdminBooking(id);
}
