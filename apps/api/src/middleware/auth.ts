import type { NextFunction, Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { getActiveAuthSession } from '../modules/auth/auth.service.js';

const { JWT_SECRET: jwtSecret, COOKIE_NAME: cookieName } = loadConfig();

export type AuthUser = {
  sub: string;
  sid: string;
  role: 'customer' | 'studio_owner' | 'admin';
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

    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      });
      if (typeof verified === 'string')
        throw new Error('Invalid token payload');
      payload = verified;
    } catch {
      next(invalidSession());
      return;
    }

    if (
      typeof payload.sub !== 'string' ||
      !isUuid(payload.sub) ||
      typeof payload.sid !== 'string' ||
      !isUuid(payload.sid) ||
      (payload.role !== 'customer' &&
        payload.role !== 'studio_owner' &&
        payload.role !== 'admin')
    ) {
      next(invalidSession());
      return;
    }

    try {
      const session = await getActiveAuthSession(payload.sid, payload.sub);
      if (!session) {
        next(invalidSession());
        return;
      }

      if (roles.length > 0 && !roles.includes(session.role)) {
        next(
          new AppError(
            403,
            'FORBIDDEN',
            'Bạn không có quyền thực hiện thao tác này.',
          ),
        );
        return;
      }

      request.user = {
        sub: session.userId,
        sid: session.id,
        role: session.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Run after requireAuth so permissions always use the current database role. */
export function requireRole(role: AuthUser['role']): RequestHandler {
  return (request, _response, next) => {
    if (request.user?.role !== role) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          role === 'admin'
            ? 'Chỉ quản trị viên mới được truy cập khu vực quản trị.'
            : 'Bạn không có quyền truy cập khu vực này.',
        ),
      );
      return;
    }
    next();
  };
}

function invalidSession(): AppError {
  return new AppError(
    401,
    'UNAUTHORIZED',
    'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  );
}
