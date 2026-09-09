const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'https://webhook.trtelecom.net';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'signal'> & {
  body?: unknown;
  token?: string;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, token, headers, timeoutMs = 12000, ...requestOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A consulta demorou demais. Tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  let data: unknown = rawText;

  if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  if (!response.ok) {
    let message = 'Não foi possível concluir a solicitação.';
    if (typeof data === 'object' && data !== null) {
      const payload = data as {
        message?: unknown;
        error?: unknown;
        details?: unknown;
      };
      const base =
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : typeof payload.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : '';
      const detail =
        typeof payload.details === 'string' && payload.details.trim()
          ? payload.details.trim()
          : '';
      if (base && detail) message = `${base} (${detail})`;
      else if (base) message = base;
      else if (detail) message = detail;
    } else if (typeof data === 'string' && data.trim()) {
      message = data.trim();
    }
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
