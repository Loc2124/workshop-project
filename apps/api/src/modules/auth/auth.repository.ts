import { query } from '../../db/pool.js';

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'organizer' | 'admin';
  passwordHash: string;
  createdAt: string;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT
      id,
      email,
      full_name AS "fullName",
      password_hash AS "passwordHash",
      role,
      created_at AS "createdAt"
     FROM users
     WHERE lower(email) = lower($1)`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT
      id,
      email,
      full_name AS "fullName",
      password_hash AS "passwordHash",
      role,
      created_at AS "createdAt"
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  fullName: string,
): Promise<UserRow> {
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING
       id,
       email,
       full_name AS "fullName",
       password_hash AS "passwordHash",
       role,
       created_at AS "createdAt"`,
    [email, passwordHash, fullName],
  );

  return result.rows[0];
}

export async function findOrganizerIdByUserId(
  userId: string,
): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id
     FROM organizers
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.id ?? null;
}
