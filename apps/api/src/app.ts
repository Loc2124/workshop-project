import cookieParser from 'cookie-parser';
import express from 'express';
import { createApiRateLimiter } from './middleware/rate-limits.js';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { getSiteSettings } from './modules/settings/settings.repository.js';
import studioRoutes from './modules/studios/studios.routes.js';
import workshopRoutes from './modules/workshops/workshops.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import meRoutes from './modules/auth/me.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import imageRoutes from './modules/images/images.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import { loadConfig } from './config.js';
import { corsForWeb } from './middleware/cors.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import paymentWebhookRoutes from './modules/payments/webhook.routes.js';

export function createApp() {
  const app = express();

  // API responses can contain account-specific data. Do not let browsers or
  // proxies reuse them, and avoid conditional 304 responses for stale entries.
  app.disable('etag');
  app.use(corsForWeb(loadConfig().WEB_ORIGIN));
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  app.use(
    pinoHttp({
      genReqId: () => randomUUID(),
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.headers.x-signature',
          'req.headers.x-payos-signature',
        ],
        censor: '[Redacted]',
      },
    }),
  );
  app.use(createApiRateLimiter());
  app.use(
    '/webhooks',
    express.raw({ type: 'application/json', limit: '100kb', inflate: false }),
    paymentWebhookRoutes,
  );
  app.use(express.json({ limit: '100kb', inflate: false }));
  app.use(cookieParser());

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/auth', authRoutes);
  app.get('/settings', async (_req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json({ settings: await getSiteSettings() }),
  );
  app.use('/me', meRoutes);
  app.use('/', bookingRoutes);
  app.use('/payments', paymentRoutes);
  app.use('/', catalogRoutes);
  app.use('/studios', studioRoutes);
  app.use('/images', imageRoutes);
  app.use('/reports', reportRoutes);
  app.use('/studios/:studioId', workshopRoutes);
  app.use('/studios/:studioId', sessionRoutes);
  app.use('/admin', adminRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
