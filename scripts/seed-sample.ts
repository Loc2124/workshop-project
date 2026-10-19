import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as argon2 from 'argon2';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { assertSafeTestDatabase } from './assert-safe-test-db.js';
import { closePool, withTransaction } from '../apps/api/src/db/pool.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const samplePath = resolve(projectRoot, 'data', 'workshops.sample.json');

const sampleWorkshopSchema = z.array(
  z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      category: z.string().min(1),
      level: z.enum(['beginner', 'intermediate', 'all']),
      audience: z.array(z.string()),
      takeaway: z.string().nullable().optional(),
      duration_minutes: z.number().int().positive(),
      price_hint: z.number().int().nonnegative(),
      requirements: z.string().nullable().optional(),
      district: z.string().min(1),
    })
    .strict(),
);

function stableUuid(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20)}`;
}

async function main(): Promise<void> {
  loadDotenv({ path: resolve(projectRoot, '.env') });
  if (process.env.NODE_ENV === 'test') {
    assertSafeTestDatabase();
  }
  const sampleData = sampleWorkshopSchema.parse(
    JSON.parse(await readFile(samplePath, 'utf8')),
  );
  const passwordHash = await argon2.hash(randomUUID());

  await withTransaction(async (client) => {
    const insertedUser = await client.query<{ id: string; role: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('sample-organizer@workshop.local', $1, 'Đơn vị workshop mô phỏng', 'organizer')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, role`,
      [passwordHash],
    );
    const existingUser =
      insertedUser.rows[0] ??
      (
        await client.query<{ id: string; role: string }>(
          `SELECT id, role
           FROM users
           WHERE email = 'sample-organizer@workshop.local'`,
        )
      ).rows[0];
    if (!existingUser || existingUser.role !== 'organizer') {
      throw new Error(
        'sample-organizer@workshop.local is already used by a non-organizer account.',
      );
    }
    const organizer = await client.query<{ id: string }>(
      `INSERT INTO organizers (user_id, name, description, district, status)
       VALUES ($1, 'Không gian thủ công mô phỏng', 'Đơn vị tổ chức dữ liệu mẫu mô phỏng.', 'Quận 1', 'approved')
       ON CONFLICT (user_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         district = EXCLUDED.district,
         status = 'approved'
       RETURNING id`,
      [existingUser.id],
    );

    for (const [index, sample] of sampleData.entries()) {
      const workshopId = stableUuid(`workshop-sample:${sample.id}`);
      await client.query(
        `INSERT INTO workshops (
           id, organizer_id, title, description, category, level, audience,
           takeaway, duration_minutes, base_price, requirements, district,
           status, is_simulated
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'approved', true
         )
         ON CONFLICT (id)
         DO UPDATE SET
           organizer_id = EXCLUDED.organizer_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           level = EXCLUDED.level,
           audience = EXCLUDED.audience,
           takeaway = EXCLUDED.takeaway,
           duration_minutes = EXCLUDED.duration_minutes,
           base_price = EXCLUDED.base_price,
           requirements = EXCLUDED.requirements,
           district = EXCLUDED.district,
           status = 'approved',
           is_simulated = true`,
        [
          workshopId,
          organizer.rows[0].id,
          sample.title,
          sample.description,
          sample.category,
          sample.level,
          sample.audience,
          sample.takeaway ?? null,
          sample.duration_minutes,
          sample.price_hint,
          sample.requirements ?? null,
          sample.district,
        ],
      );

      for (let occurrence = 0; occurrence < 2; occurrence += 1) {
        const sessionId = stableUuid(
          `workshop-sample-session:${sample.id}:${occurrence + 1}`,
        );
        const startsAt = new Date(
          Date.now() + (7 + index * 2 + occurrence) * 24 * 60 * 60 * 1000,
        );
        const endsAt = new Date(
          startsAt.getTime() + sample.duration_minutes * 60 * 1000,
        );
        await client.query(
          `INSERT INTO sessions (
             id, workshop_id, starts_at, ends_at, price, capacity
           )
           VALUES ($1, $2, $3, $4, $5, 12)
           ON CONFLICT (id)
           DO UPDATE SET
             starts_at = EXCLUDED.starts_at,
             ends_at = EXCLUDED.ends_at,
             price = EXCLUDED.price,
             capacity = EXCLUDED.capacity,
             status = 'scheduled'
           WHERE sessions.seats_held = 0
             AND sessions.seats_sold = 0`,
          [
            sessionId,
            workshopId,
            startsAt.toISOString(),
            endsAt.toISOString(),
            sample.price_hint,
          ],
        );
      }
    }
  });

  console.log(`Seeded ${sampleData.length} simulated workshops.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
