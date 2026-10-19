import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';
import { findOrganizerIdByUserId } from '../modules/auth/auth.repository.js';

export type AuthUser = {
  sub: string;
  role: 'customer' | 'organizer' | 'admin';
  organizerId?: string | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(roles: AuthUser['role'][] = []) {
  return async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const cookieName = process.env.COOKIE_NAME || 'workshop_session';
    const token = request.cookies?.[cookieName];

    if (!token) {
      next(
        new AppError(
          401,
          'UNAUTHORIZED',
          'Bạn cần đăng nhập để thực hiện thao tác này.',
        ),
      );
      return;
    }

    const jwtSecret =
      process.env.JWT_SECRET || 'change-me-to-a-long-random-string';

    try {
      const payload = jwt.verify(token, jwtSecret) as {
        sub?: string;
        role?: AuthUser['role'];
        organizerId?: string | null;
      };

      if (!payload.sub || !payload.role) {
        throw new Error('Invalid token payload');
      }

      if (roles.length > 0 && !roles.includes(payload.role)) {
        next(
          new AppError(
            403,
            'FORBIDDEN',
            'Bạn không có quyền thực hiện thao tác này.',
          ),
        );
        return;
      }

      let organizerId = payload.organizerId ?? null;
      if (payload.role === 'organizer' && !organizerId) {
        organizerId = await findOrganizerIdByUserId(payload.sub);
      }

      request.user = {
        sub: payload.sub,
        role: payload.role,
        organizerId,
      };
      next();
    } catch {
      next(
        new AppError(
          401,
          'UNAUTHORIZED',
          'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
        ),
      );
    }
  };
}
