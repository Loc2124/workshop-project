import { query } from '../db/pool.js';
import { loadConfig } from '../config.js';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  type?: string;
  idempotencyKey?: string;
};

type EmailLog = {
  id: string;
  email_type: string;
  recipient: string;
  subject: string;
  html_body: string;
  text_body: string;
  idempotency_key: string | null;
};

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const recipient = input.to.trim().toLowerCase();
  const suppressed = await query(
    'SELECT 1 FROM email_suppressions WHERE email=$1',
    [recipient],
  );
  if (suppressed.rowCount)
    throw new Error('Email delivery suppressed for this recipient.');

  const inserted = await query<{ id: string }>(
    `INSERT INTO email_logs(email_type,recipient,subject,html_body,text_body,idempotency_key)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(idempotency_key) DO UPDATE SET
       status='pending',last_error=NULL,html_body=EXCLUDED.html_body,
       text_body=EXCLUDED.text_body,subject=EXCLUDED.subject,attempts=email_logs.attempts
     WHERE email_logs.status='failed'
     RETURNING id`,
    [
      input.type ?? 'transactional',
      recipient,
      input.subject,
      input.html,
      input.text,
      input.idempotencyKey ?? null,
    ],
  );
  let logId = inserted.rows[0]?.id;
  if (!logId && input.idempotencyKey) {
    const existing = await query<{ id: string; status: string }>(
      'SELECT id,status FROM email_logs WHERE idempotency_key=$1',
      [input.idempotencyKey],
    );
    if (existing.rows[0]?.status === 'sent')
      return { id: existing.rows[0].id };
    if (existing.rows[0]?.status === 'pending')
      return { id: existing.rows[0].id };
    logId = existing.rows[0]?.id;
  }
  if (!logId) {
    const created = await query<{ id: string }>(
      `INSERT INTO email_logs(email_type,recipient,subject,html_body,text_body)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [input.type ?? 'transactional', recipient, input.subject, input.html, input.text],
    );
    logId = created.rows[0]!.id;
  }
  return deliverLog(logId);
}

async function deliverLog(id: string): Promise<{ id: string }> {
  const row = await query<EmailLog>(
    `UPDATE email_logs SET status='pending',attempts=attempts+1,last_error=NULL
     WHERE id=$1 AND status IN ('pending','failed') RETURNING *`,
    [id],
  );
  const email = row.rows[0];
  if (!email) return { id };
  try {
    const { RESEND_API_KEY, EMAIL_FROM } = loadConfig();
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (email.idempotency_key)
      headers['Idempotency-Key'] = email.idempotency_key;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email.recipient],
        reply_to: 'hotro@openslot.vn',
        subject: email.subject,
        html: email.html_body,
        text: email.text_body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}.`);
    const resendId =
      typeof result === 'object' && result !== null && 'id' in result &&
      typeof result.id === 'string'
        ? result.id
        : null;
    await query(
      `UPDATE email_logs SET status='sent',resend_id=$2,sent_at=now(),last_error=NULL WHERE id=$1`,
      [id, resendId],
    );
    return { id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed.';
    await query(`UPDATE email_logs SET status='failed',last_error=$2 WHERE id=$1`, [
      id,
      message.slice(0, 500),
    ]);
    throw error;
  }
}

export function queueEmail(input: SendEmailInput): void {
  void sendEmail(input).catch((error: unknown) => {
    console.error('Email delivery failed.', error);
  });
}

export async function retryFailedEmails(limit = 50): Promise<number> {
  const failed = await query<{ id: string }>(
    `SELECT id FROM email_logs WHERE status='failed' AND attempts<5
     AND created_at>now()-interval '7 days'
     ORDER BY created_at LIMIT $1`,
    [limit],
  );
  let sent = 0;
  for (const { id } of failed.rows) {
    try {
      await deliverLog(id);
      sent++;
    } catch (error) {
      console.error('Email retry failed.', error);
    }
  }
  return sent;
}

export async function processResendEvent(input: {
  id: string;
  resendId?: string;
  type: string;
  email: string;
}): Promise<void> {
  const reason = input.type === 'email.complained' ? 'complaint' : 'bounce';
  const email = input.email.trim().toLowerCase();
  await query(
    `INSERT INTO email_suppressions(email,reason,source_event_id)
     VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET
       reason=EXCLUDED.reason,source_event_id=EXCLUDED.source_event_id`,
    [email, reason, input.id],
  );
  if (input.resendId)
    await query(
      `UPDATE email_logs SET status=$3 WHERE lower(recipient)=$1 AND resend_id=$2`,
      [email, input.resendId, reason === 'complaint' ? 'complaint' : 'bounced'],
    );
}

export async function retryLog(id: string): Promise<void> {
  await deliverLog(id);
}
