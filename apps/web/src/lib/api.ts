const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337/api';

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function apiDownload(path: string, token: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download CSV.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  const fileName = disposition?.match(/filename=([^;]+)/)?.[1] || 'report.csv';

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/"/g, '');
  link.click();
  URL.revokeObjectURL(url);
}

export { API_BASE };
