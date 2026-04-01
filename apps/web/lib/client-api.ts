import { parseApiResponse } from './api-error';

export async function clientApiRequest<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers
  });

  return parseApiResponse<T>(response);
}
