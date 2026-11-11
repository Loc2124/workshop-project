import { Router } from 'express';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { createApiRateLimiter } from '../../middleware/rate-limits.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import {
  encryptFinancialAccount,
  financialAccountEncryptionAvailable,
} from '../payments/financial-account-crypto.js';
import { writeAuditLog } from '../admin/audit-log.js';

export const payoutAccountsRouter = Router();
const path = '/:studioId/payout-account';
payoutAccountsRouter.use(path, requireAuth(), validateUuidParam('studioId'));

payoutAccountsRouter.get(path, async (req, res) => {
  const studioId = String(req.params.studioId);
  const owner = await query(
    `SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2 AND role='owner'`,
    [studioId, req.user!.sub],
  );
  if (!owner.rowCount)
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được xem tài khoản nhận tiền.',
    );
  const accounts = await query(
    `SELECT id,bank_name AS "bankName",bank_bin AS "bankBin",account_holder AS "accountHolder",account_last4 AS "last4",
      status,is_current AS "isCurrent",created_at AS "createdAt",verified_at AS "verifiedAt"
     FROM studio_payout_accounts WHERE studio_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [studioId],
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    enabled: financialAccountEncryptionAvailable(),
    items: accounts.rows,
  });
});

payoutAccountsRouter.put(
  path,
  createApiRateLimiter({ limit: 5, windowMs: 15 * 60_000 }),
  async (req, res) => {
    const input = z
      .object({
        bankName: z.string().trim().min(2).max(120),
        bankBin: z
          .string()
          .regex(/^[0-9]{6}$/)
          .optional(),
        accountHolder: z.string().trim().min(2).max(160),
        accountNumber: z.string().regex(/^[0-9]{4,30}$/),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(req.body);
    const studioId = String(req.params.studioId);
    const account = encryptFinancialAccount(input.accountNumber);
    const saved = await withTransaction(async (client) => {
      const owner = await client.query<{ passwordHash: string }>(
        `SELECT u.password_hash AS "passwordHash" FROM studios st
       JOIN studio_members sm ON sm.studio_id=st.id AND sm.role='owner'
       JOIN users u ON u.id=sm.user_id
       WHERE st.id=$1 AND u.id=$2 AND NOT u.is_blocked FOR UPDATE OF st`,
        [studioId, req.user!.sub],
      );
      if (!owner.rows[0])
        throw new AppError(
          403,
          'FORBIDDEN',
          'Chỉ chủ studio được đổi tài khoản nhận tiền.',
        );
      if (!(await argon2.verify(owner.rows[0].passwordHash, input.password)))
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'Mật khẩu chưa đúng. Vui lòng thử lại.',
        );
      const previous = await client.query<{ id: string; last4: string }>(
        `UPDATE studio_payout_accounts SET is_current=false WHERE studio_id=$1 AND is_current
       RETURNING id,account_last4 AS last4`,
        [studioId],
      );
      const result = await client.query<{ id: string }>(
        `INSERT INTO studio_payout_accounts(studio_id,bank_name,bank_bin,account_holder,account_last4,encrypted_number,encryption_iv,encryption_tag,changed_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          studioId,
          input.bankName,
          input.bankBin ?? null,
          input.accountHolder,
          input.accountNumber.slice(-4),
          account.encrypted,
          account.iv,
          account.tag,
          req.user!.sub,
        ],
      );
      await client.query(
        `INSERT INTO user_notifications(user_id,type,title,body,href)
       VALUES($1,'studio_payout_account_changed','Đã đổi tài khoản nhận tiền',
         'Tài khoản mới cần được đối chiếu trước khi studio nhận chi trả.',$2)`,
        [req.user!.sub, `/studio/${studioId}/profile`],
      );
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'studio.payout_account.changed',
        targetType: 'studio',
        targetId: studioId,
        targetName: 'Tài khoản nhận tiền studio',
        before: {
          accountId: previous.rows[0]?.id ?? null,
          last4: previous.rows[0]?.last4 ?? null,
        },
        after: {
          accountId: result.rows[0]!.id,
          last4: input.accountNumber.slice(-4),
          status: 'pending',
        },
      });
      return {
        id: result.rows[0]!.id,
        last4: input.accountNumber.slice(-4),
        status: 'pending',
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(saved);
  },
);
