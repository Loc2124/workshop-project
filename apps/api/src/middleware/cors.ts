import type { NextFunction, Request, Response } from 'express';

const allowedMethods = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type, Authorization, X-Requested-With';
const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function corsForWeb(webOrigin: string | string[]) {
  const allowed = new Set(
    Array.isArray(webOrigin)
      ? webOrigin.filter(Boolean)
      : [webOrigin].filter(Boolean),
  );
  // Luôn cho phép các origin local khi phát triển và chạy thử nghiệm
  allowed.add('http://localhost:3000');
  allowed.add('http://localhost:5173');
  allowed.add('http://127.0.0.1:3000');
  allowed.add('http://127.0.0.1:5173');

  return (request: Request, response: Response, next: NextFunction) => {
    response.vary('Origin');

    const origin = request.get('Origin');
    const isAllowedOrigin = origin ? allowed.has(origin) : false;

    if (origin && isAllowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Methods', allowedMethods);
      response.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      response.setHeader(
        'Access-Control-Expose-Headers',
        'Retry-After, RateLimit, RateLimit-Policy',
      );
      response.setHeader('Access-Control-Max-Age', '600');
    }

    if (request.method === 'OPTIONS') {
      response.sendStatus(origin && !isAllowedOrigin ? 403 : 204);
      return;
    }

    if (
      origin &&
      stateChangingMethods.has(request.method) &&
      !isAllowedOrigin
    ) {
      response.status(403).json({
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Origin này không được phép gửi yêu cầu thay đổi dữ liệu.',
        },
      });
      return;
    }

    next();
  };
}
