import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
loadDotenv({ path: resolve(projectRoot, '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

// Master / system configuration tables that must NOT be truncated
const PRESERVED_TABLES = new Set([
  'schema_migrations',
  'migrations',
  'categories',
  'provinces',
  'districts',
  'wards',
  'settings',
  'message_templates',
]);

async function main() {
  console.log('Connecting to PostgreSQL database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    console.log('Connected! Fetching list of tables to clean...');
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'`,
    );

    const allTables = tablesRes.rows.map((r) => r.table_name);
    const tablesToTruncate = allTables.filter((t) => !PRESERVED_TABLES.has(t));

    console.log(`Found ${tablesToTruncate.length} tables to truncate:`);
    console.log(tablesToTruncate.join(', '));

    if (tablesToTruncate.length > 0) {
      console.log('Temporarily disabling immutable trigger on audit_logs...');
      try {
        await client.query('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable;');
      } catch (e) {
        console.warn('Could not disable audit_logs trigger, continuing:', e);
      }

      const truncateSql = `TRUNCATE TABLE ${tablesToTruncate.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
      console.log('Truncating tables...');
      await client.query(truncateSql);

      try {
        await client.query('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable;');
        console.log('Re-enabled immutable trigger on audit_logs.');
      } catch (e) {
        console.warn('Could not re-enable audit_logs trigger:', e);
      }

      console.log('All transactional, user, and studio data truncated successfully!');
    }

    // Now insert the fresh Admin account requested by user
    const adminEmail = 'admin@openslot.io.vn';
    const adminPassword = 'openslot';
    console.log(`Hashing password for Admin (${adminEmail})...`);
    const passwordHash = await argon2.hash(adminPassword);

    console.log('Inserting fresh Admin account...');
    const insertRes = await client.query<{ id: string; email: string; role: string; fullName: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, 'Quản Trị Viên Hệ Thống', 'admin')
       RETURNING id, email, role, full_name AS "fullName"`,
      [adminEmail, passwordHash],
    );

    console.log('Admin account created successfully:', insertRes.rows[0]);
    console.log('\n=============================================');
    console.log('DATABASE CLEANUP & RESET COMPLETE!');
    console.log('Admin Email:    ' + adminEmail);
    console.log('Admin Password: ' + adminPassword);
    console.log('Database is completely clean and ready for registration/demo!');
    console.log('=============================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
