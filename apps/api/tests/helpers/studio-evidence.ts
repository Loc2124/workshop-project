import { randomUUID } from 'node:crypto';
import { query } from '../../src/db/pool.js';

export async function seedStudioEvidence(studioId: string, userId?: string) {
  const owner =
    userId ??
    (
      await query<{ id: string }>(
        `SELECT id FROM users ORDER BY created_at LIMIT 1`,
      )
    ).rows[0]?.id;
  if (!owner) throw new Error('Seed a user before studio evidence.');
  process.env.SUPABASE_URL ??= 'https://storage.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??=
    'unit-test-storage-key-not-for-production';
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  await query(
    `INSERT INTO images(id,studio_id,uploaded_by,key,state,byte_size) SELECT id,$2::uuid,$3::uuid,'studios/'||($2::uuid)::text||'/profile/'||id::text||'.webp','ready',100 FROM unnest($1::uuid[]) AS id`,
    [ids, studioId, owner],
  );
  await query(
    `UPDATE studios SET contact_phone='0901234567',contact_email='studio@example.test',photo_ids=$2 WHERE id=$1`,
    [studioId, ids],
  );
  return {
    contactPhone: '0901234567',
    contactEmail: 'studio@example.test',
    photoIds: ids,
  };
}

export async function draftStudioProfile(
  app: Parameters<typeof import('supertest').default>[0],
  cookie: string,
) {
  const request = (await import('supertest')).default;
  const response = await request(app)
    .post('/studios/drafts')
    .set('Cookie', cookie);
  if (response.status !== 201)
    throw new Error(`Draft failed: ${response.status}`);
  const studioId = response.body.studio.id as string;
  const owner = (
    await query<{ user_id: string }>(
      `SELECT user_id FROM studio_members WHERE studio_id=$1 AND role='owner'`,
      [studioId],
    )
  ).rows[0].user_id;
  return {
    draftStudioId: studioId,
    ...(await seedStudioEvidence(studioId, owner)),
  };
}
