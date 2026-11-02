import { writeAuditLog } from './audit-log.js';
import { z } from 'zod';
import {
  messageTemplateSpecs,
  messageTemplateKeySchema,
  messageTemplateEditSchema,
  renderMessageTemplate,
  type MessageTemplateKey,
} from '@workshop/shared';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
export { messageTemplateKeySchema, messageTemplateEditSchema };
export const templateSave = messageTemplateEditSchema
  .extend({ expectedVersion: z.string().regex(/^\d+$/) })
  .strict();
export const templateReset = z
  .object({ expectedVersion: z.string().regex(/^\d+$/) })
  .strict();
const columns =
  't.key,t.subject,t.body,t.updated_by AS "updatedBy",t.updated_at AS "updatedAt",u.full_name AS "updatedByName",t.xmin::text AS version';
export async function listMessageTemplates() {
  return {
    templates: (
      await query<{
        key: MessageTemplateKey;
        subject: string;
        body: string;
        updatedBy: string | null;
        updatedByName: string | null;
        updatedAt: Date;
        version: string;
      }>(
        `SELECT ${columns} FROM message_templates t LEFT JOIN users u ON u.id=t.updated_by`,
      )
    ).rows
      .sort(
        (a, b) =>
          messageTemplateKeySchema.options.indexOf(a.key) -
          messageTemplateKeySchema.options.indexOf(b.key),
      )
      .map((row) => ({
        ...row,
        label: messageTemplateSpecs[row.key as MessageTemplateKey].label,
        variables:
          messageTemplateSpecs[row.key as MessageTemplateKey].variables,
      })),
  };
}
export function previewMessageTemplate(
  key: MessageTemplateKey,
  input: z.infer<typeof messageTemplateEditSchema>,
) {
  return {
    preview: renderMessageTemplate(
      key,
      input,
      messageTemplateSpecs[key].sample,
    ),
    sample: messageTemplateSpecs[key].sample,
  };
}
export async function saveMessageTemplate(
  key: MessageTemplateKey,
  actor: string,
  input: z.infer<typeof templateSave> | z.infer<typeof templateReset>,
  reset = false,
) {
  await withTransaction(async (client) => {
    const previous = (
      await client.query<{ version: string }>(
        'SELECT xmin::text AS version FROM message_templates WHERE key=$1 FOR UPDATE',
        [key],
      )
    ).rows[0];
    if (!previous)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy mẫu thông báo.');
    if (previous.version !== input.expectedVersion)
      throw new AppError(
        409,
        'CONFLICT',
        'Mẫu đã được admin khác cập nhật. Hãy tải lại mẫu trước khi lưu.',
      );
    if (reset)
      await client.query(
        'UPDATE message_templates t SET subject=d.subject,body=d.body,updated_by=$2,updated_at=clock_timestamp() FROM default_message_template($1) d WHERE t.key=$1',
        [key, actor],
      );
    else {
      const edit = messageTemplateEditSchema.parse({
        subject: 'subject' in input ? input.subject : '',
        body: 'body' in input ? input.body : '',
      });
      await client.query(
        'UPDATE message_templates SET subject=$2,body=$3,updated_by=$4,updated_at=clock_timestamp() WHERE key=$1',
        [key, edit.subject, edit.body, actor],
      );
    }
    await writeAuditLog(client, {
      actorId: actor,
      action: reset ? 'message_template.reset' : 'message_template.updated',
      targetType: 'message_template',
      targetId: key,
      targetName: messageTemplateSpecs[key].label,
      reason: `templateKey=${key}`,
    });
  });
  return listMessageTemplates();
}
