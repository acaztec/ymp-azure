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

  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('Received an unexpected response from the server. Please try again.');
  }

  if (!response.ok) {
    const message = body?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}
