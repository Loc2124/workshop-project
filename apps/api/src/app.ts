import cookieParser from 'cookie-parser';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import organizerRoutes from './modules/organizers/organizers.routes.js';
import workshopRoutes from './modules/workshops/workshops.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { getCurrentUser } from './modules/auth/auth.service.js';
import { AppError } from './errors/app-error.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    pinoHttp({
      genReqId: () => randomUUID(),
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.x-signature',
          'req.headers.x-payos-signature',
        ],
        censor: '[Redacted]',
      },
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
    }),
  );

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/auth', authRoutes);
  app.use('/', catalogRoutes);
  app.use('/organizer', organizerRoutes);
  app.use('/organizer', workshopRoutes);
  app.use('/organizer', sessionRoutes);
  app.use('/admin', adminRoutes);
  app.get('/me', requireAuth(), async (request, response) => {
    const user = await getCurrentUser(request.user!.sub);
    if (!user) {
      throw new AppError(
        401,
        'UNAUTHORIZED',
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    }
    response.json({ user });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
