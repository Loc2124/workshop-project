import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.'));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Dữ liệu gửi lên không hợp lệ.',
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi nội bộ.',
    },
  });
};
