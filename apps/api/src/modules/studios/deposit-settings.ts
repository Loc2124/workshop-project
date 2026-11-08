import { Router } from 'express';
import { calculateDeposit, depositSettingsSchema } from '@workshop/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { studioDepositEligibleSql } from './studio-profile-sql.js';
import { writeAuditLog } from '../admin/audit-log.js';

export const depositSettingsRouter = Router();
const fields = `st.deposit_mode AS "depositMode",st.deposit_percent AS "depositPercent",st.release_if_unconfirmed AS "releaseIfUnconfirmed",st.release_before_minutes AS "releaseBeforeMinutes"`;
depositSettingsRouter.use(
  '/:studioId/payment-settings',
  requireAuth(),
  validateUuidParam('studioId'),
);
depositSettingsRouter.get('/:studioId/payment-settings', async (req, res) => {
  const id = String(req.params.studioId);
  const state = await query(
    `SELECT ${fields},${studioDepositEligibleSql} AS eligible FROM studios st JOIN studio_members sm ON sm.studio_id=st.id WHERE st.id=$1 AND sm.user_id=$2`,
    [id, req.user!.sub],
  );
  if (!state.rows[0])
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  const history = await query(
    `SELECT h.id,COALESCE(h.actor_name,u.full_name,'Hệ thống') AS "actorName",h.before_state AS "before",h.after_state AS "after",h.created_at AS "createdAt" FROM studio_deposit_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.studio_id=$1 ORDER BY h.created_at DESC LIMIT 50`,
    [id],
  );
  res.json({
    settings: state.rows[0],
    history: history.rows,
    minimumPaymentAmount: process.env.PAYMENT_MIN_AMOUNT
      ? Number(process.env.PAYMENT_MIN_AMOUNT)
      : null,
  });
});
depositSettingsRouter.put('/:studioId/payment-settings', async (req, res) => {
  const input = depositSettingsSchema.parse(req.body),
    id = String(req.params.studioId);
  await withTransaction(async (client) => {
    const old = await client.query(
      `SELECT ${fields},st.name,${studioDepositEligibleSql} AS eligible FROM studios st JOIN studio_members sm ON sm.studio_id=st.id WHERE st.id=$1 AND sm.user_id=$2 AND sm.role='owner' FOR UPDATE OF st`,
      [id, req.user!.sub],
    );
    if (!old.rows[0])
      throw new AppError(
        403,
        'FORBIDDEN',
        'Chỉ chủ studio được thay đổi cách thanh toán.',
      );
    if (!old.rows[0].eligible && input.depositMode !== 'none')
      throw new AppError(403, 'FORBIDDEN', 'Xác minh studio để bật đặt cọc.');
    const minimum = Number(process.env.PAYMENT_MIN_AMOUNT ?? 0);
    if (input.depositMode !== 'none' && minimum > 0) {
      const prices = await client.query<{ title: string; price: number }>(
        `SELECT w.title,LEAST(w.base_price,COALESCE(min(s.price),w.base_price)) AS price FROM workshops w LEFT JOIN sessions s ON s.workshop_id=w.id AND s.status='scheduled' AND s.starts_at>now() WHERE w.studio_id=$1 AND w.deposit_mode_override IS NULL GROUP BY w.id`,
        [id],
      );
      const invalid = prices.rows.find(
        (row) =>
          row.price > 0 &&
          calculateDeposit(row.price, input.depositPercent!) < minimum,
      );
      if (invalid)
        throw new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          `Tiền cọc của “${invalid.title}” thấp hơn mức thanh toán tối thiểu ${minimum.toLocaleString('vi-VN')} đ. Vui lòng tăng mức cọc hoặc chọn không cọc.`,
        );
    }
    await client.query(
      `UPDATE studios SET deposit_mode=$2,deposit_percent=$3,release_if_unconfirmed=$4,release_before_minutes=$5 WHERE id=$1`,
      [
        id,
        input.depositMode,
        input.depositPercent,
        input.releaseIfUnconfirmed,
        input.releaseBeforeMinutes,
      ],
    );
    const { name } = old.rows[0];
    const before = {
      depositMode: old.rows[0].depositMode,
      depositPercent: old.rows[0].depositPercent,
      releaseIfUnconfirmed: old.rows[0].releaseIfUnconfirmed,
      releaseBeforeMinutes: old.rows[0].releaseBeforeMinutes,
    };
    if (JSON.stringify(before) !== JSON.stringify(input)) {
      await client.query(
        'INSERT INTO studio_deposit_history(studio_id,actor_id,actor_name,before_state,after_state) VALUES($1,$2,(SELECT full_name FROM users WHERE id=$2),$3::jsonb,$4::jsonb)',
        [id, req.user!.sub, JSON.stringify(before), JSON.stringify(input)],
      );
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'studio.payment_settings.updated',
        targetType: 'studio',
        targetId: id,
        targetName: name,
        before,
        after: input,
      });
    }
  });
  res.json({
    ok: true,
    warnings:
      input.depositMode !== 'none' && !process.env.PAYMENT_MIN_AMOUNT
        ? [
            'Chưa có mức thanh toán tối thiểu. Liên hệ Open Slot để kiểm tra trước khi nhận cọc.',
          ]
        : [],
  });
});
