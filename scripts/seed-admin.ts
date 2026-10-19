import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as argon2 from 'argon2';
import { query } from '../apps/api/src/db/pool.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
loadDotenv({ path: resolve(projectRoot, '.env') });

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured.',
    );
  }

  const passwordHash = await argon2.hash(password);

  await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, 'System Admin', 'admin')
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       full_name = EXCLUDED.full_name`,
    [email.toLowerCase(), passwordHash],
  );

  console.log(`Seeded admin user for ${email}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
