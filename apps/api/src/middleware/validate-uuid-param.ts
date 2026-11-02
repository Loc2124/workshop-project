import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

const uuidSchema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuidParam(name: string): RequestHandler {
  return (request, _response, next) => {
    const value = request.params[name];
    if (typeof value !== 'string' || !uuidSchema.test(value)) {
      next(new AppError(400, 'BAD_REQUEST', 'ID không hợp lệ.'));
      return;
    }

    next();
  };
}
