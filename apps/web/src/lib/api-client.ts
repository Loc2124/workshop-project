const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new ApiError(
      `Yêu cầu không thành công (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as T;
}
