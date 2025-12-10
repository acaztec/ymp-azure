export async function callApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
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
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  };

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
