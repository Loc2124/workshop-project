import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { closePool, withTransaction } from '../../src/db/pool.js';

beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(() => closePool());

it('restores real owner workshops while retaining the dedicated sample owner data as simulated', async () => {
  const sql = await readFile(
    new URL(
      '../../../../db/migrations/033_real_workshop_default.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const rollback = new Error('Rollback simulation fixture');
  await expect(
    withTransaction(async (client) => {
      const real = (
        await client.query(
          `INSERT INTO users(email,password_hash,full_name) VALUES ($1,'unused','Real owner') RETURNING id`,
          [`${randomUUID()}@example.test`],
        )
      ).rows[0].id;
      await client.query(
        `INSERT INTO users(email,password_hash,full_name) VALUES ('sample-studio@workshop.local','unused','Sample owner') ON CONFLICT(email) DO NOTHING`,
      );
      const sample = (
        await client.query(
          `SELECT id FROM users WHERE email='sample-studio@workshop.local'`,
        )
      ).rows[0].id;
      const workshops: string[] = [];
      for (const owner of [real, sample]) {
        const studio = (
          await client.query(
            `INSERT INTO studios(name,province_id,address,status) VALUES ('Flag fixture','ho-chi-minh','Test address','approved') RETURNING id`,
          )
        ).rows[0].id;
        await client.query(
          `INSERT INTO studio_members(studio_id,user_id,role) VALUES ($1,$2,'owner')`,
          [studio, owner],
        );
        const id = randomUUID();
        workshops.push(id);
        await client.query(
          `INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,is_simulated) VALUES ($1::uuid,$2,'Flag fixture',$1::text,'Test','ceramics',90,10000,true)`,
          [id, studio],
        );
      }
      await client.query(sql);
      const rows = await client.query(
        'SELECT id,is_simulated FROM workshops WHERE id=ANY($1::uuid[])',
        [workshops],
      );
      expect(
        rows.rows.find((row) => row.id === workshops[0]).is_simulated,
      ).toBe(false);
      expect(
        rows.rows.find((row) => row.id === workshops[1]).is_simulated,
      ).toBe(true);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});

it('migrates pending publications without restoring drafts or rejected/hidden/removed content', async () => {
  const sql = await readFile(
    new URL(
      '../../../../db/migrations/032_remove_workshop_preapproval.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const rollback = new Error('Rollback migration fixture');
  await expect(
    withTransaction(async (client) => {
      const studio = (
        await client.query(
          `INSERT INTO studios(name,province_id,address,status) VALUES ('Migration test','ho-chi-minh','Test address','approved') RETURNING id`,
        )
      ).rows[0].id;
      const cases = [
        ['pending', 'active', 'published', 'active'],
        ['pending', 'active', 'draft', 'active'],
        ['pending', 'hidden', 'published', 'hidden'],
        ['rejected', 'active', 'published', 'hidden'],
        ['rejected', 'removed', 'published', 'removed'],
      ];
      const ids: string[] = [];
      for (const [status, visibility, publication] of cases) {
        const id = randomUUID();
        ids.push(id);
        await client.query(
          `INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status,visibility_status,publication_status) VALUES ($1::uuid,$2::uuid,'Migration test',$1::text,'Test','ceramics',90,10000,$3::approval_status,$4,$5)`,
          [id, studio, status, visibility, publication],
        );
      }
      await client.query(sql);
      for (const [index, id] of ids.entries()) {
        const row = (
          await client.query(
            'SELECT status,visibility_status,publication_status FROM workshops WHERE id=$1',
            [id],
          )
        ).rows[0];
        expect(row).toMatchObject({
          status: 'approved',
          visibility_status: cases[index][3],
          publication_status: cases[index][2],
        });
        const logs = await client.query(
          `SELECT id FROM audit_logs WHERE target_id=$1 AND action='workshop.publication_migrated'`,
          [id],
        );
        expect(logs.rows).toHaveLength(1);
      }
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
