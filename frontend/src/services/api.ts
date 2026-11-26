const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof data.error === 'string' ? data.error : 'İşlem sırasında bir hata oluştu.',
      data.details && typeof data.details === 'object' ? data.details : undefined,
    );
  }

  return data as T;
}

function extractDownloadFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ? match[1] : fallback;
}

export async function apiDownload(
  path: string,
  fallbackFilename: string,
): Promise<{ filename: string; blob: Blob }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      typeof data.error === 'string' ? data.error : 'Dosya indirilemedi.',
      data.details && typeof data.details === 'object' ? data.details : undefined,
    );
  }

  const blob = await response.blob();
  const filename = extractDownloadFilename(
    response.headers.get('Content-Disposition'),
    fallbackFilename,
  );
  return { filename, blob };
}
