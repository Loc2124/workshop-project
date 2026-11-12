const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function apiUrl(path: string): URL {
  if (apiBaseUrl.startsWith('/')) {
    return new URL(
      `${apiBaseUrl.replace(/\/$/, '')}${path}`,
      window.location.origin,
    );
  }
  return new URL(path, apiBaseUrl);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiAbortError extends Error {
  constructor() {
    super('Yêu cầu đã bị hủy.');
    this.name = 'ApiAbortError';
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('Yêu cầu đã hết thời gian chờ.');
    this.name = 'ApiTimeoutError';
  }
}

export class ApiNetworkError extends Error {
  constructor() {
    super('Chưa kết nối được với Open Slot. Vui lòng thử lại.');
    this.name = 'ApiNetworkError';
  }
}

export class ApiResponseError extends Error {
  constructor() {
    super('Máy chủ trả về dữ liệu không hợp lệ.');
    this.name = 'ApiResponseError';
  }
}

type ApiRequestInit = RequestInit & { responseType?: 'json' | 'void' };

let refreshPromise: Promise<unknown> | undefined;

function refreshSession(): Promise<unknown> {
  if (!refreshPromise) {
    const epoch = sessionEpoch();
    refreshPromise = apiFetch<{ user: unknown }>('/auth/refresh', {
      method: 'POST',
    })
      .then(async (result) => {
        if (sessionEpoch() !== epoch) throw new ApiAbortError();
        await emitSessionEvent({ type: 'refreshed', user: result.user, epoch });
        // Never replay an old request with another account's refreshed cookies.
        if (sessionEpoch() !== epoch) throw new ApiAbortError();
        return result;
      })
      .catch(async (error) => {
        // A temporary network/server failure does not invalidate the refresh
        // cookie. A rejected token or malformed successful response does.
        if (
          sessionEpoch() === epoch &&
          (error instanceof ApiError
            ? error.status === 401
            : !(error instanceof ApiNetworkError) &&
              !(error instanceof ApiTimeoutError) &&
              !(error instanceof ApiAbortError))
        )
          await emitSessionEvent({ type: 'expired', epoch });
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}

export function apiFetch(
  path: string,
  init: ApiRequestInit & { responseType: 'void' },
): Promise<void>;
export function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T>;
export async function apiFetch<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T | void> {
  return request<T>(path, init, true);
}

async function request<T>(
  path: string,
  init: ApiRequestInit,
  canRefresh: boolean,
): Promise<T | void> {
  const { responseType, ...fetchInit } = init;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...fetchInit,
      credentials: 'include',
      headers,
    });
  } catch (error) {
    throw classifyRequestError(error, init.signal);
  }

  if (response.status === 204 || response.status === 205) {
    if (responseType !== 'void') {
      throw new ApiResponseError();
    }
    return;
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw classifyRequestError(error, init.signal);
  }

  if (response.status === 401 && canRefresh && !path.startsWith('/auth/')) {
    await refreshSession();
    if (init.signal?.aborted)
      throw classifyRequestError(undefined, init.signal);
    return request<T>(path, init, false);
  }

  if (!response.ok) {
    const error = createApiError(response.status, body);
    const header = response.headers.get('Retry-After');
    const delay = header
      ? /^\d+$/.test(header)
        ? Number(header)
        : Math.max(0, Math.ceil((Date.parse(header) - Date.now()) / 1000))
      : null;
    const retryAfter = delay !== null && Number.isFinite(delay) ? delay : null;
    throw new ApiError(
      response.status === 429
        ? `Bạn thao tác quá nhanh. ${retryAfter !== null ? `Vui lòng chờ ${retryAfter} giây rồi thử lại.` : 'Vui lòng chờ một chút rồi thử lại.'}`
        : error.message,
      error.status,
      error.code,
      retryAfter,
    );
  }

  if (responseType === 'void') {
    if (body) throw new ApiResponseError();
    return;
  }

  if (!body) {
    throw new ApiResponseError();
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiResponseError();
  }
}

export function shouldRetryApiQuery(
  failureCount: number,
  error: unknown,
): boolean {
  return (
    failureCount < 1 &&
    !(error instanceof ApiAbortError) &&
    !(error instanceof ApiError && error.status >= 400 && error.status < 500)
  );
}

function createApiError(status: number, body: string): ApiError {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isApiErrorPayload(parsed)) {
      return new ApiError(parsed.error.message, status, parsed.error.code);
    }
  } catch {
    // Use the status-based fallback for non-JSON and malformed error responses.
  }

  return new ApiError(`Yêu cầu không thành công (${status}).`, status);
}

function isApiErrorPayload(
  value: unknown,
): value is { error: { code: string; message: string } } {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const error = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

function classifyRequestError(
  error: unknown,
  signal: AbortSignal | null | undefined,
): Error {
  const reason = signal?.reason;
  if (
    isNamedError(reason, 'TimeoutError') ||
    isNamedError(error, 'TimeoutError')
  ) {
    return new ApiTimeoutError();
  }
  if (signal?.aborted || isNamedError(error, 'AbortError')) {
    return new ApiAbortError();
  }
  return new ApiNetworkError();
}

function isNamedError(value: unknown, name: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    value.name === name
  );
}
import { emitSessionEvent, sessionEpoch } from '../domain/session-events';
