import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as argon2 from 'argon2';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { VIETNAM_PROVINCES } from '../apps/api/src/constants/vietnam-provinces.js';
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
      categoryId: z.string().min(1),
      level: z.enum(['beginner', 'intermediate', 'all']),
      audience: z.array(z.string()),
      takeaway: z.string().nullable().optional(),
      duration_minutes: z.number().int().positive(),
      price_hint: z.number().int().nonnegative(),
      requirements: z.string().nullable().optional(),
      province: z.enum(VIETNAM_PROVINCES),
      address: z.string().trim().min(1).max(500),
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
       VALUES ('sample-studio@workshop.local', $1, 'Chủ xưởng mô phỏng', 'customer')
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
           WHERE email = 'sample-studio@workshop.local'`,
        )
      ).rows[0];
    if (!existingUser || existingUser.role !== 'customer') {
      throw new Error(
        'sample-studio@workshop.local is already used by a non-customer account.',
      );
    }

    for (const [index, sample] of sampleData.entries()) {
      const studioId = stableUuid(`studio-sample:${sample.id}`);
      const studio = await client.query<{ id: string }>(
        `INSERT INTO studios (
           id, name, description, district, province_id, address, category_id, status
         )
         SELECT $1, $2, $3, NULL, p.id, $4, $6, 'approved'
         FROM provinces p
         WHERE p.name = $5
         ON CONFLICT (id)
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           province_id = EXCLUDED.province_id,
           category_id = EXCLUDED.category_id,
           address = EXCLUDED.address,
           status = 'approved'
         RETURNING id`,
        [
          studioId,
          sample.title,
          'Xưởng mô phỏng dùng cho dữ liệu workshop mẫu.',
          sample.address,
          sample.province,
          sample.categoryId,
        ],
      );
      if (!studio.rows[0]) {
        throw new Error(`Province not found for sample: ${sample.province}`);
      }
      await client.query(
        `INSERT INTO studio_members (studio_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (studio_id, user_id)
         DO UPDATE SET role = 'owner'`,
        [studioId, existingUser.id],
      );

      const workshopId = stableUuid(`workshop-sample:${sample.id}`);
      await client.query(
        `INSERT INTO workshops (
           id, studio_id, title, description, category_id, level, audience,
           takeaway, duration_minutes, base_price, requirements,
           status, is_simulated
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           'approved', true
         )
         ON CONFLICT (id)
         DO UPDATE SET
           studio_id = EXCLUDED.studio_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           category_id = EXCLUDED.category_id,
           level = EXCLUDED.level,
           audience = EXCLUDED.audience,
           takeaway = EXCLUDED.takeaway,
           duration_minutes = EXCLUDED.duration_minutes,
           base_price = EXCLUDED.base_price,
           requirements = EXCLUDED.requirements,
           status = 'approved',
           is_simulated = true`,
        [
          workshopId,
          studio.rows[0].id,
          sample.title,
          sample.description,
          sample.categoryId,
          sample.level,
          sample.audience,
          sample.takeaway ?? null,
          sample.duration_minutes,
          sample.price_hint,
          sample.requirements ?? null,
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
