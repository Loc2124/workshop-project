import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { AppError } from '../../errors/app-error.js';
import {
  createUser,
  findOrganizerIdByUserId,
  findUserByEmail,
  findUserById,
} from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export type AuthUserPublic = {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'organizer' | 'admin';
  organizerId?: string | null;
};

const jwtSecret = process.env.JWT_SECRET || 'change-me-to-a-long-random-string';

export async function registerCustomer(
  input: RegisterInput,
): Promise<{ user: AuthUserPublic }> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Email này đã được sử dụng.');
  }

  const passwordHash = await argon2.hash(input.password);
  const created = await createUser(email, passwordHash, fullName);

  return {
    user: serializePublicUser(created, null),
  };
}

export async function loginCustomer(input: LoginInput): Promise<{
  token: string;
  user: AuthUserPublic;
}> {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(email);

  if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new AppError(401, 'UNAUTHORIZED', 'Email hoặc mật khẩu không chính xác.');
  }

  const organizerId = await findOrganizerIdByUserId(user.id);
  const token = signAccessToken(user.id, user.role, organizerId);

  return {
    token,
    user: serializePublicUser(user, organizerId),
  };
}

export async function getCurrentUser(
  userId: string,
): Promise<AuthUserPublic | null> {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  const organizerId = await findOrganizerIdByUserId(user.id);
  return serializePublicUser(user, organizerId);
}

function serializePublicUser(
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'customer' | 'organizer' | 'admin';
  },
  organizerId: string | null,
): AuthUserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizerId: organizerId ?? undefined,
  };
}

function signAccessToken(
  userId: string,
  role: 'customer' | 'organizer' | 'admin',
  organizerId: string | null,
): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

  return jwt.sign(
    {
      sub: userId,
      role,
      ...(organizerId ? { organizerId } : {}),
    },
    jwtSecret,
    {
      expiresIn,
    },
  );
}
