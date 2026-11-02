import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import {
  createSignedUploadUrl,
  inspectUploadedImage,
  imageStorageConfig,
  storageRequest,
  removeStorageImages,
} from '../images/image-storage.js';
export const reportBucket = 'report-attachments';
export async function reserveReportImage(user: string, size: number) {
  const id = randomUUID(),
    key = `reports/${user}/${id}.webp`;
  await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user]);
    const count = (
      await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM report_attachments WHERE reporter_id=$1 AND report_id IS NULL AND created_at>now()-interval '1 day'",
        [user],
      )
    ).rows[0].n;
    if (count >= 12)
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Bạn có nhiều ảnh chưa gửi. Hãy xóa ảnh không dùng hoặc thử lại sau.',
      );
    await client.query(
      'INSERT INTO report_attachments(id,reporter_id,key,byte_size) VALUES($1,$2,$3,$4)',
      [id, user, key, size],
    );
  });
  return {
    id,
    signedUploadUrl: await createSignedUploadUrl(key, reportBucket),
  };
}
export async function confirmReportImage(id: string, user: string) {
  const attachment = (
    await query<{ key: string; byte_size: number; state: string }>(
      "SELECT key,byte_size,state FROM report_attachments WHERE id=$1 AND reporter_id=$2 AND report_id IS NULL AND created_at>now()-interval '2 hours'",
      [id, user],
    )
  ).rows[0];
  if (!attachment)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ảnh đính kèm.');
  await inspectUploadedImage(
    attachment.key,
    attachment.byte_size,
    reportBucket,
  );
  await query(
    "UPDATE report_attachments SET state='ready' WHERE id=$1 AND reporter_id=$2 AND report_id IS NULL",
    [id, user],
  );
  return { id };
}
export async function deleteReportImage(id: string, user: string) {
  await withTransaction(async (client) => {
    const image = (
      await client.query<{ key: string }>(
        'SELECT key FROM report_attachments WHERE id=$1 AND reporter_id=$2 AND report_id IS NULL FOR UPDATE',
        [id, user],
      )
    ).rows[0];
    if (!image)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ảnh chưa gửi.');
    await removeStorageImages([image.key], reportBucket);
    await client.query('DELETE FROM report_attachments WHERE id=$1', [id]);
  });
  return { ok: true };
}
export async function signedReportImages(reportId: string) {
  const images = (
    await query<{ id: string; key: string }>(
      "SELECT id,key FROM report_attachments WHERE report_id=$1 AND state='ready' ORDER BY created_at,id",
      [reportId],
    )
  ).rows;
  return Promise.all(
    images.map(async (image) => {
      const response = await storageRequest(
        `object/sign/${reportBucket}/${image.key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 300 }),
        },
      );
      if (!response.ok)
        throw new AppError(
          503,
          'SERVICE_UNAVAILABLE',
          'Chưa tải được ảnh báo cáo. Vui lòng thử lại.',
        );
      const body = z
        .object({ signedURL: z.string() })
        .parse(await response.json());
      return {
        id: image.id,
        url: new URL(
          `/storage/v1${body.signedURL}`,
          imageStorageConfig().SUPABASE_URL,
        ).href,
      };
    }),
  );
}
