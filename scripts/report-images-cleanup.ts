import { config } from 'dotenv';
import { Pool } from 'pg';
import { removeStorageImages } from '../apps/api/src/modules/images/image-storage.js';
config();
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const result = await pool.query<{ id: string; key: string }>(
      "SELECT id,key FROM report_attachments WHERE report_id IS NULL AND created_at<now()-interval '1 day' LIMIT 100",
    );
    for (const image of result.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query(
          'SELECT id FROM report_attachments WHERE id=$1 AND report_id IS NULL FOR UPDATE',
          [image.id],
        );
        if (locked.rowCount) {
          await removeStorageImages([image.key], 'report-attachments');
          await client.query('DELETE FROM report_attachments WHERE id=$1', [
            image.id,
          ]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(`Cleaned up ${result.rowCount} abandoned report attachments.`);
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error('Report attachment cleanup failed.');
  process.exitCode = 1;
});
