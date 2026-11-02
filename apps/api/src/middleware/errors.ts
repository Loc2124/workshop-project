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

  const parserError = getParserError(error);
  if (parserError) {
    response.status(parserError.status).json({
      error: {
        code: parserError.code,
        message: parserError.message,
      },
    });
    return;
  }

  const databaseError = getDatabaseError(error);
  if (databaseError) {
    response.status(databaseError.status).json({
      error: {
        code: databaseError.code,
        message: databaseError.message,
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

function getParserError(error: unknown): {
  status: 400 | 413 | 415;
  code: 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE';
  message: string;
} | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return null;
  }

  switch (error.type) {
    case 'entity.parse.failed':
      return {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Dữ liệu JSON không hợp lệ.',
      };
    case 'entity.too.large':
      return {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Kích thước dữ liệu gửi lên vượt giới hạn.',
      };
    case 'encoding.unsupported':
      return {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Không hỗ trợ dữ liệu request đã nén.',
      };
    default:
      return null;
  }
}

function getDatabaseError(error: unknown): {
  status: 409 | 422;
  code: 'CONFLICT' | 'UNPROCESSABLE_ENTITY';
  message: string;
} | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = error.code;
  if (typeof code !== 'string') return null;
  if (
    code === 'P0001' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.startsWith('BOOKING_SLOT_LIMIT:')
  )
    return {
      status: 409,
      code: 'CONFLICT',
      message:
        'Bạn đã đạt số buổi sắp tới tối đa được phép đặt. Hủy một buổi hoặc chờ hoàn tất trước khi đặt thêm.',
    };

  if (code === '23505') {
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'Dữ liệu bị trùng với tài nguyên hiện có.',
    };
  }

  if (
    code === '23502' ||
    code === '23503' ||
    code === '23514' ||
    code === '22001' ||
    code === '22003' ||
    code === '22P02'
  ) {
    return {
      status: 422,
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Dữ liệu gửi lên không hợp lệ.',
    };
  }

  return null;
}
