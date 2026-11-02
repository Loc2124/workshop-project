import { AppError } from '../../errors/app-error.js';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../db/pool.js';

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'studio_owner' | 'admin';
  passwordHash: string;
  isBlocked: boolean;
  createdAt: string;
};

export type AuthSessionUser = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: 'customer' | 'studio_owner' | 'admin';
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT
      id,
      email,
      full_name AS "fullName",
      password_hash AS "passwordHash", is_blocked AS "isBlocked",
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
      password_hash AS "passwordHash", is_blocked AS "isBlocked",
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
       password_hash AS "passwordHash", is_blocked AS "isBlocked",
       role,
       created_at AS "createdAt"`,
    [email, passwordHash, fullName],
  );

  return result.rows[0];
}

export async function createAuthSession(
  userId: string,
  refreshTokenHash: string,
  expiresAt: Date,
): Promise<string> {
  return withTransaction(async (client) => {
    const user = await client.query<{ is_blocked: boolean }>(
      'SELECT is_blocked FROM users WHERE id=$1 FOR SHARE',
      [userId],
    );
    if (!user.rows[0] || user.rows[0].is_blocked)
      throw new AppError(
        403,
        'FORBIDDEN',
        'Tài khoản đã bị khóa. Vui lòng liên hệ Open Slot.',
      );
    await client.query(
      `DELETE FROM auth_sessions
       WHERE user_id = $1
         AND (revoked_at IS NOT NULL OR expires_at <= now())`,
      [userId],
    );
    const result = await client.query<{ id: string }>(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, refreshTokenHash, expiresAt],
    );
    return result.rows[0].id;
  });
}

export async function rotateAuthSession(
  refreshTokenHash: string,
  nextRefreshTokenHash: string,
  expiresAt: Date,
): Promise<AuthSessionUser | null> {
  return withTransaction(async (client) => {
    const owner = await client.query(
      'SELECT users.id FROM users JOIN auth_sessions ON auth_sessions.user_id=users.id WHERE auth_sessions.refresh_token_hash=$1 AND NOT users.is_blocked FOR SHARE OF users',
      [refreshTokenHash],
    );
    if (!owner.rowCount) return null;
    const session = await findRefreshSessionForUpdate(client, refreshTokenHash);
    if (!session) return null;

    await client.query(
      `UPDATE auth_sessions
       SET refresh_token_hash = $1,
           expires_at = $2,
           last_used_at = now()
       WHERE id = $3`,
      [nextRefreshTokenHash, expiresAt, session.id],
    );
    return session;
  });
}

export async function findActiveAuthSession(
  sessionId: string,
  userId: string,
): Promise<AuthSessionUser | null> {
  const result = await query<AuthSessionUser>(
    `SELECT
       auth_sessions.id,
       users.id AS "userId",
       users.email,
       users.full_name AS "fullName",
       users.role
     FROM auth_sessions
     JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.id = $1
       AND auth_sessions.user_id = $2
       AND NOT users.is_blocked
       AND auth_sessions.revoked_at IS NULL
       AND auth_sessions.expires_at > now()`,
    [sessionId, userId],
  );
  return result.rows[0] ?? null;
}

export async function revokeAuthSessionByRefreshHash(
  refreshTokenHash: string,
): Promise<void> {
  await query(
    `UPDATE auth_sessions
     SET revoked_at = now()
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL`,
    [refreshTokenHash],
  );
}

export async function revokeAuthSessionById(
  sessionId: string,
  userId: string,
): Promise<void> {
  await query(
    `UPDATE auth_sessions
     SET revoked_at = now()
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL`,
    [sessionId, userId],
  );
}

async function findRefreshSessionForUpdate(
  client: PoolClient,
  refreshTokenHash: string,
): Promise<AuthSessionUser | null> {
  const result = await client.query<AuthSessionUser>(
    `SELECT
       auth_sessions.id,
       users.id AS "userId",
       users.email,
       users.full_name AS "fullName",
       users.role
     FROM auth_sessions
     JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.refresh_token_hash = $1
       AND NOT users.is_blocked
       AND auth_sessions.revoked_at IS NULL
       AND auth_sessions.expires_at > now()
     FOR UPDATE OF auth_sessions`,
    [refreshTokenHash],
  );
  return result.rows[0] ?? null;
}
