import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { newPasswordSchema } from '@workshop/shared';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import {
  createAuthSession,
  createPasswordReset,
  completePasswordReset,
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
import { queueEmail } from '../../services/email.js';
import { emailTemplate } from '../../services/templates.js';

const {
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: accessTokenExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
} = loadConfig();

export type AuthUserPublic = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: 'customer' | 'studio_owner' | 'admin';
  createdAt?: string;
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
  const passwordHash = await hashPassword(input.password);
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

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const user = await findUserByEmail(emailInput.trim().toLowerCase());
  if (!user || user.isBlocked) return;
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await createPasswordReset(user.id, tokenHash);
  const resetUrl = new URL('/dat-lai-mat-khau', loadConfig().CLIENT_URL);
  resetUrl.searchParams.set('token', token);
  const content = emailTemplate({
    title: 'Đặt lại mật khẩu Open Slot',
    paragraphs: [
      `Xin chào ${user.fullName}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.`,
      'Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    ],
    cta: { label: 'Đặt lại mật khẩu', href: resetUrl.toString() },
  });
  queueEmail({
    to: user.email,
    subject: 'Đặt lại mật khẩu Open Slot',
    ...content,
    type: 'password_reset',
    idempotencyKey: `password-reset:${tokenHash}`,
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<boolean> {
  const parsed = newPasswordSchema.safeParse(password);
  if (!parsed.success)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      parsed.error.issues[0]?.message ?? 'Mật khẩu chưa đạt yêu cầu.',
    );
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await completePasswordReset(
    tokenHash,
    await hashPassword(password),
  );
  if (!user) return false;
  const content = emailTemplate({
    title: 'Mật khẩu đã được thay đổi',
    paragraphs: [
      `Xin chào ${user.fullName}, mật khẩu tài khoản Open Slot của bạn vừa được thay đổi.`,
      'Tất cả phiên đăng nhập cũ đã được kết thúc. Nếu bạn không thực hiện thay đổi này, hãy liên hệ hotro@openslot.vn ngay.',
    ],
    cta: {
      label: 'Đăng nhập Open Slot',
      href: new URL('/dang-nhap', loadConfig().CLIENT_URL).toString(),
    },
  });
  queueEmail({
    to: user.email,
    subject: 'Mật khẩu Open Slot đã được thay đổi',
    ...content,
    type: 'password_changed',
    idempotencyKey: `password-changed:${tokenHash}`,
  });
  return true;
}

export async function hashPassword(password: string): Promise<string> {
  await assertPasswordNotCompromised(password);
  return argon2.hash(password);
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
  phone?: string | null;
  role: 'customer' | 'studio_owner' | 'admin';
  createdAt?: string;
}): AuthUserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    role: user.role,
    createdAt: user.createdAt,
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
