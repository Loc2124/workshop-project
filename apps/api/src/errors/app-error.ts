export type AppErrorCode =
  | 'RATE_LIMITED'
  | 'PASSWORD_COMPROMISED'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE_ENTITY';

export class AppError extends Error {
  constructor(
    public readonly statusCode:
      400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 503,
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
