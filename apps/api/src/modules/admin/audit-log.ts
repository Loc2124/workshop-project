import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

export type AuditEvent = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  before?: unknown;
  after?: unknown;
};

/** Use the mutation's transaction. DB snapshots omit user credentials and tokens.
 * The activity mirror calls write_audit_log atomically and keeps overview history compatible.
 */
export async function writeAuditLog(client: PoolClient, event: AuditEvent) {
  const hashed = ['category', 'message_template', 'settings'].includes(
    event.targetType,
  );
  const digest = createHash('md5').update(event.targetId).digest('hex');
  const legacyId = hashed
    ? `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`
    : event.targetId;
  if ('before' in event || 'after' in event) {
    await client.query('SELECT set_config($1,$2,true)', [
      `app.audit_${event.targetType}_${digest}`,
      JSON.stringify({
        targetId: event.targetId,
        before: event.before ?? null,
        after: event.after ?? null,
      }),
    ]);
  }
  await client.query(
    `INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason,previous_status,new_status)
     SELECT id,full_name,$2,$3,$4::uuid,$5,$6,$7,$8 FROM users WHERE id=$1`,
    [
      event.actorId,
      event.action,
      event.targetType,
      legacyId,
      event.targetName,
      event.reason ?? null,
      event.previousStatus ?? null,
      event.newStatus ?? null,
    ],
  );
}
