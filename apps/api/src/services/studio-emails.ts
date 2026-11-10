import { query } from '../db/pool.js';
import { loadConfig } from '../config.js';
import { queueEmail } from './email.js';
import { emailTemplate } from './templates.js';

export function queueStudioDecisionEmail(
  studioId: string,
  status: 'approved' | 'rejected',
  reason?: string,
) {
  void (async () => {
    const result = await query<{
      email: string;
      fullName: string;
      name: string;
      reviewedAt: Date | null;
    }>(
      `SELECT u.email,u.full_name AS "fullName",st.name,st.reviewed_at AS "reviewedAt"
       FROM studios st JOIN studio_members sm ON sm.studio_id=st.id AND sm.role='owner'
       JOIN users u ON u.id=sm.user_id WHERE st.id=$1 ORDER BY sm.created_at LIMIT 1`,
      [studioId],
    );
    const owner = result.rows[0];
    if (!owner) return;
    const approved = status === 'approved';
    const title = approved
      ? 'Hồ sơ studio đã được duyệt'
      : 'Cần cập nhật hồ sơ studio';
    const content = emailTemplate({
      title,
      paragraphs: [
        `Xin chào ${owner.fullName},`,
        approved
          ? `Hồ sơ ${owner.name} đã được duyệt. Bạn có thể hoàn thiện workshop và lịch trên Open Slot.`
          : `Hồ sơ ${owner.name} chưa được duyệt.${reason?.trim() ? ` Lý do: ${reason.trim()}` : ''} Vui lòng cập nhật hồ sơ rồi gửi lại.`,
      ],
      cta: {
        label: approved ? 'Quản lý studio' : 'Cập nhật hồ sơ',
        href: new URL(
          approved ? '/studio' : '/dang-ky-studio',
          loadConfig().CLIENT_URL,
        ).toString(),
      },
    });
    queueEmail({
      to: owner.email,
      subject: `${title}: ${owner.name}`,
      ...content,
      type: approved ? 'studio_approved' : 'studio_rejected',
      idempotencyKey: `studio-decision:${studioId}:${status}:${owner.reviewedAt?.toISOString() ?? 'unknown'}`,
    });
  })().catch((error: unknown) =>
    console.error('Studio decision email failed.', error),
  );
}
