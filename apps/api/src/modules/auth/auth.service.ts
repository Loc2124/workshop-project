import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import {
  createAuthSession,
  createUser,
  findActiveAuthSession,
  findUserByEmail,
  findUserById,
  revokeAuthSessionById,
  revokeAuthSessionByRefreshHash,
  rotateAuthSession,
  type AuthSessionUser,
} from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { assertPasswordNotCompromised } from './password-check.js';

const {
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: accessTokenExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
} = loadConfig();

export type AuthUserPublic = {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'studio_owner' | 'admin';
};

export async function registerCustomer(
  input: RegisterInput,
): Promise<{ user: AuthUserPublic }> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  const existing = await findUserByEmail(email);
  if (existing) {
    throw duplicateEmailError();
  }

  await assertPasswordNotCompromised(input.password);
  const passwordHash = await argon2.hash(input.password);
  let created: Awaited<ReturnType<typeof createUser>>;
  try {
    created = await createUser(email, passwordHash, fullName);
  } catch (error) {
    if (isEmailUniqueViolation(error)) {
      throw duplicateEmailError();
    }
    throw error;
  }

  return {
    user: serializePublicUser(created),
  };
}

export async function loginCustomer(input: LoginInput): Promise<{
  token: string;
  refreshToken: string;
  user: AuthUserPublic;
}> {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(email);

  if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Email hoặc mật khẩu không chính xác.',
    );
  }

  if (user.isBlocked)
    throw new AppError(
      403,
      'FORBIDDEN',
      'Tài khoản đã bị khóa. Vui lòng liên hệ Open Slot.',
    );
  const refreshToken = createRefreshToken();
  const sessionId = await createAuthSession(
    user.id,
    hashRefreshToken(refreshToken),
    new Date(Date.now() + durationToMilliseconds(refreshTokenExpiresIn)),
  );
  const token = signAccessToken(user.id, user.role, sessionId);

  return {
    token,
    refreshToken,
    user: serializePublicUser(user),
  };
}

export async function refreshCustomerSession(refreshToken: string): Promise<{
  token: string;
  refreshToken: string;
  user: AuthUserPublic;
} | null> {
  const nextRefreshToken = createRefreshToken();
  const session = await rotateAuthSession(
    hashRefreshToken(refreshToken),
    hashRefreshToken(nextRefreshToken),
    new Date(Date.now() + durationToMilliseconds(refreshTokenExpiresIn)),
  );
  if (!session) return null;

  return {
    token: signAccessToken(session.userId, session.role, session.id),
    refreshToken: nextRefreshToken,
    user: serializePublicUser({ ...session, id: session.userId }),
  };
}

export async function logoutCurrentSession(
  accessToken: string | undefined,
  refreshToken: string | undefined,
): Promise<void> {
  if (refreshToken) {
    await revokeAuthSessionByRefreshHash(hashRefreshToken(refreshToken));
  }
  if (!accessToken) return;

  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(accessToken, jwtSecret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });
    if (typeof verified === 'string') return;
    payload = verified;
  } catch {
    return;
  }

  if (
    typeof payload.sub === 'string' &&
    isUuid(payload.sub) &&
    typeof payload.sid === 'string' &&
    isUuid(payload.sid)
  ) {
    await revokeAuthSessionById(payload.sid, payload.sub);
  }
}

export async function getActiveAuthSession(
  sessionId: string,
  userId: string,
): Promise<AuthSessionUser | null> {
  return findActiveAuthSession(sessionId, userId);
}

export async function getCurrentUser(
  userId: string,
): Promise<AuthUserPublic | null> {
  const user = await findUserById(userId);
  if (!user || user.isBlocked) {
    return null;
  }

  return serializePublicUser(user);
}

function serializePublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'studio_owner' | 'admin';
}): AuthUserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

function signAccessToken(
  userId: string,
  role: 'customer' | 'studio_owner' | 'admin',
  sessionId: string,
): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      sid: sessionId,
    },
    jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: accessTokenExpiresIn as jwt.SignOptions['expiresIn'],
    },
  );
}

function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function durationToMilliseconds(duration: string): number {
  const match = duration.match(/^([1-9]\d*)(s|m|h|d)$/i);
  if (!match) {
    throw new Error('Invalid token duration configuration.');
  }
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const multiplier = multipliers[match[2].toLowerCase()];
  if (multiplier === undefined) {
    throw new Error('Invalid token duration configuration.');
  }
  return Number(match[1]) * multiplier;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isEmailUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'users_email_key'
  );
}

function duplicateEmailError(): AppError {
  return new AppError(409, 'CONFLICT', 'Email này đã được sử dụng.');
}
