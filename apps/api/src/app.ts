import cookieParser from 'cookie-parser';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
