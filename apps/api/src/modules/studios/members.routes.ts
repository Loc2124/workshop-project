import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { AppError } from '../../errors/app-error.js';

const router = Router();

const createInvitationSchema = z.object({
  email: z.string().trim().email('Địa chỉ email không hợp lệ').max(255),
});

const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, 'Mã lời mời không được để trống'),
});

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// 1. GET /studios/:studioId/members - Lấy danh sách thành viên và lời mời đang chờ
router.get(
  '/:studioId/members',
  requireAuth(['customer', 'studio_owner', 'admin']),
  validateUuidParam('studioId'),
  async (request: Request, response: Response) => {
    const studioId = String(request.params.studioId);
    const userId = request.user!.sub;
    const isSystemAdmin = request.user!.role === 'admin';

    // Kiểm tra quyền: Phải là owner hoặc staff của studio (hoặc system admin)
    const membershipCheck = await query<{ role: 'owner' | 'staff' }>(
      'SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2',
      [studioId, userId],
    );
    const userRole = membershipCheck.rows[0]?.role;
    if (!isSystemAdmin && !userRole) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập studio này.');
    }

    // Lấy danh sách thành viên
    const membersResult = await query<{
      userId: string;
      email: string;
      fullName: string;
      role: 'owner' | 'staff';
      joinedAt: string;
    }>(
      `SELECT 
        u.id AS "userId",
        u.email,
        u.full_name AS "fullName",
        sm.role,
        sm.created_at AS "joinedAt"
      FROM studio_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.studio_id = $1
      ORDER BY sm.role ASC, sm.created_at ASC`,
      [studioId],
    );

    // Lấy danh sách lời mời pending (chỉ owner hoặc admin mới thấy)
    let pendingInvitations: Array<{
      id: string;
      email: string;
      role: string;
      expiresAt: string;
      createdAt: string;
    }> = [];

    if (isSystemAdmin || userRole === 'owner') {
      const invitationsResult = await query<{
        id: string;
        email: string;
        role: string;
        expiresAt: string;
        createdAt: string;
      }>(
        `SELECT 
          id,
          email,
          role,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
        FROM studio_invitations
        WHERE studio_id = $1 AND status = 'pending' AND expires_at > now()
        ORDER BY created_at DESC`,
        [studioId],
      );
      pendingInvitations = invitationsResult.rows;
    }

    response.json({
      members: membersResult.rows,
      invitations: pendingInvitations,
      pendingInvitations,
      currentUserRole: userRole ?? 'owner',
    });
  },
);

// 2. POST /studios/:studioId/invitations - Tạo lời mời nhân viên
router.post(
  '/:studioId/invitations',
  requireAuth(['customer', 'studio_owner', 'admin']),
  validateUuidParam('studioId'),
  async (request: Request, response: Response) => {
    const studioId = String(request.params.studioId);
    const userId = request.user!.sub;
    const isSystemAdmin = request.user!.role === 'admin';

    // Chỉ owner của studio (hoặc admin) mới được mời nhân viên
    if (!isSystemAdmin) {
      const ownerCheck = await query<{ role: string }>(
        "SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2 AND role = 'owner'",
        [studioId, userId],
      );
      if (!ownerCheck.rows[0]) {
        throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ sở hữu studio mới có quyền mời nhân viên.');
      }
    }

    const { email } = createInvitationSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase();

    // Kiểm tra xem người này đã là thành viên studio chưa
    const existingMember = await query(
      `SELECT 1 FROM studio_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.studio_id = $1 AND lower(u.email) = $2`,
      [studioId, normalizedEmail],
    );
    if (existingMember.rows.length > 0) {
      throw new AppError(409, 'CONFLICT', 'Tài khoản này đã là thành viên của studio.');
    }

    // Tạo token ngẫu nhiên và băm hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const result = await withTransaction(async (client) => {
      // Hủy các lời mời cũ còn pending cho cùng email tại studio này
      await client.query(
        "UPDATE studio_invitations SET status = 'revoked', updated_at = now() WHERE studio_id = $1 AND lower(email) = $2 AND status = 'pending'",
        [studioId, normalizedEmail],
      );

      // Thêm lời mời mới có hạn 7 ngày
      const insertResult = await client.query<{
        id: string;
        email: string;
        role: string;
        expiresAt: string;
      }>(
        `INSERT INTO studio_invitations (studio_id, email, role, token_hash, expires_at, created_by)
         VALUES ($1, $2, 'staff', $3, now() + interval '7 days', $4)
         RETURNING id, email, role, expires_at AS "expiresAt"`,
        [studioId, normalizedEmail, tokenHash, userId],
      );
      return insertResult.rows[0];
    });

    response.status(201).json({
      invitation: {
        ...result,
        inviteToken: rawToken,
        inviteLink: `/tham-gia-studio?token=${rawToken}`,
      },
    });
  },
);

// 3. DELETE /studios/:studioId/invitations/:invitationId - Thu hồi lời mời
router.delete(
  '/:studioId/invitations/:invitationId',
  requireAuth(['customer', 'studio_owner', 'admin']),
  validateUuidParam('studioId'),
  validateUuidParam('invitationId'),
  async (request: Request, response: Response) => {
    const studioId = String(request.params.studioId);
    const invitationId = String(request.params.invitationId);
    const userId = request.user!.sub;
    const isSystemAdmin = request.user!.role === 'admin';

    if (!isSystemAdmin) {
      const ownerCheck = await query<{ role: string }>(
        "SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2 AND role = 'owner'",
        [studioId, userId],
      );
      if (!ownerCheck.rows[0]) {
        throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ sở hữu studio mới có quyền thu hồi lời mời.');
      }
    }

    const updateResult = await query(
      "UPDATE studio_invitations SET status = 'revoked', updated_at = now() WHERE id = $1 AND studio_id = $2 AND status = 'pending'",
      [invitationId, studioId],
    );

    if (updateResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Lời mời không tồn tại hoặc đã được xử lý.');
    }

    response.json({ ok: true, message: 'Đã thu hồi lời mời.' });
  },
);

// 4. DELETE /studios/:studioId/members/:memberUserId - Xóa/gỡ quyền nhân viên
router.delete(
  '/:studioId/members/:memberUserId',
  requireAuth(['customer', 'studio_owner', 'admin']),
  validateUuidParam('studioId'),
  validateUuidParam('memberUserId'),
  async (request: Request, response: Response) => {
    const studioId = String(request.params.studioId);
    const targetUserId = String(request.params.memberUserId);
    const userId = request.user!.sub;
    const isSystemAdmin = request.user!.role === 'admin';

    if (!isSystemAdmin) {
      const ownerCheck = await query<{ role: string }>(
        "SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2 AND role = 'owner'",
        [studioId, userId],
      );
      if (!ownerCheck.rows[0]) {
        throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ sở hữu studio mới có quyền gỡ nhân viên.');
      }
    }

    if (targetUserId === userId) {
      throw new AppError(400, 'BAD_REQUEST', 'Chủ sở hữu không thể tự gỡ quyền của chính mình.');
    }

    // Chỉ gỡ được staff
    const deleteResult = await query(
      "DELETE FROM studio_members WHERE studio_id = $1 AND user_id = $2 AND role = 'staff'",
      [studioId, targetUserId],
    );

    if (deleteResult.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Nhân viên không tồn tại trong studio này.');
    }

    response.json({ ok: true, message: 'Đã gỡ quyền nhân viên khỏi studio.' });
  },
);

// 5. GET /studios/invitations/lookup?token=... - Tra cứu lời mời công khai
router.get('/invitations/lookup', async (request: Request, response: Response) => {
  const token = typeof request.query.token === 'string' ? request.query.token.trim() : '';
  if (!token) {
    throw new AppError(400, 'BAD_REQUEST', 'Mã lời mời không hợp lệ.');
  }

  const tokenHash = hashToken(token);
  const result = await query<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    status: string;
    studioId: string;
    studioName: string;
    studioAddress: string;
    inviterName: string;
  }>(
    `SELECT 
      i.id,
      i.email,
      i.role,
      i.expires_at AS "expiresAt",
      i.status,
      st.id AS "studioId",
      st.name AS "studioName",
      st.address AS "studioAddress",
      u.full_name AS "inviterName"
    FROM studio_invitations i
    JOIN studios st ON st.id = i.studio_id
    JOIN users u ON u.id = i.created_by
    WHERE i.token_hash = $1`,
    [tokenHash],
  );

  const invitation = result.rows[0];
  if (!invitation) {
    throw new AppError(404, 'NOT_FOUND', 'Lời mời không tồn tại hoặc liên kết không đúng.');
  }

  const isExpired = new Date(invitation.expiresAt).getTime() <= Date.now();
  if (invitation.status !== 'pending' || isExpired) {
    throw new AppError(
      410,
      'GONE',
      invitation.status === 'accepted'
        ? 'Lời mời này đã được chấp nhận trước đó.'
        : 'Lời mời này đã hết hạn hoặc bị thu hồi.',
    );
  }

  response.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      studioId: invitation.studioId,
      studioName: invitation.studioName,
      studioAddress: invitation.studioAddress,
      inviterName: invitation.inviterName,
    },
  });
});

// 6. POST /studios/invitations/accept - Chấp nhận lời mời
router.post(
  '/invitations/accept',
  requireAuth(['customer', 'studio_owner', 'admin']),
  async (request: Request, response: Response) => {
    const { token } = acceptInvitationSchema.parse(request.body);
    const userId = request.user!.sub;
    const tokenHash = hashToken(token);

    const result = await withTransaction(async (client) => {
      // Khóa và kiểm tra lời mời
      const invCheck = await client.query<{
        id: string;
        studioId: string;
        email: string;
        role: string;
        status: string;
        expiresAt: string;
        studioName: string;
      }>(
        `SELECT 
          i.id,
          i.studio_id AS "studioId",
          i.email,
          i.role,
          i.status,
          i.expires_at AS "expiresAt",
          st.name AS "studioName"
        FROM studio_invitations i
        JOIN studios st ON st.id = i.studio_id
        WHERE i.token_hash = $1
        FOR UPDATE OF i`,
        [tokenHash],
      );

      const invitation = invCheck.rows[0];
      if (!invitation) {
        throw new AppError(404, 'NOT_FOUND', 'Lời mời không tồn tại.');
      }

      if (invitation.status !== 'pending') {
        throw new AppError(
          400,
          'BAD_REQUEST',
          invitation.status === 'accepted'
            ? 'Lời mời này đã được chấp nhận rồi.'
            : 'Lời mời này đã bị thu hồi.',
        );
      }

      if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
        throw new AppError(410, 'GONE', 'Lời mời này đã hết hạn sử dụng.');
      }

      // Thêm vào bảng studio_members
      await client.query(
        `INSERT INTO studio_members (studio_id, user_id, role)
         VALUES ($1, $2, 'staff')
         ON CONFLICT (studio_id, user_id) DO UPDATE SET role = 'staff'`,
        [invitation.studioId, userId],
      );

      // Cập nhật trạng thái lời mời sang accepted
      await client.query(
        "UPDATE studio_invitations SET status = 'accepted', accepted_by = $2, accepted_at = now(), updated_at = now() WHERE id = $1",
        [invitation.id, userId],
      );

      return invitation;
    });

    response.json({
      ok: true,
      message: 'Gia nhập studio thành công!',
      studioId: result.studioId,
      studioName: result.studioName,
    });
  },
);

export const studioMembersRouter = router;
