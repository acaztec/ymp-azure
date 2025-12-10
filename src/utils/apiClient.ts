const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')

function buildUrl(path: string) {
  if (!path) return path
  if (!API_BASE_URL) return path

  return path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`
}

export async function callApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildUrl(path)
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const rawText = await response.text();
  let body: any = null;
  const logContext = {
    path,
    url,
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  };

  const contentType = response.headers.get('content-type') || ''

  if (rawText && !contentType.includes('application/json')) {
    console.error('[callApi] Received non-JSON response', { ...logContext, rawText })
    throw new Error('Received an unexpected response from the server. Please try again later.')
  }

  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error('[callApi] Failed to parse JSON response', {
      ...logContext,
      rawText,
    });
    throw new Error(
      'Received an unexpected response from the server. Raw response has been logged for troubleshooting. Please try again.'
    );
  }

  if (!response.ok) {
    const message = body?.error || `Request failed with status ${response.status}`;
    console.error('[callApi] API request failed', {
      ...logContext,
      rawText,
      body,
    });
    throw new Error(message);
  }

  return body as T;
}
