'use client';

import type { CsrfResponse } from '@packages/shared';
import { parseApiResponse } from './api-error';

const unsafeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const csrfExemptPaths = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/password/forgot',
  '/api/auth/password/reset'
]);

let csrfTokenCache: string | undefined;
let csrfTokenPromise: Promise<string> | undefined;

type ClientApiOptions = {
  idempotent?: boolean;
};

async function fetchCsrfToken(forceRefresh = false) {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfTokenPromise || forceRefresh) {
    csrfTokenPromise = fetch('/api/auth/csrf', {
      credentials: 'same-origin'
    })
      .then((response) => parseApiResponse<CsrfResponse>(response))
      .then((payload) => {
        csrfTokenCache = payload.csrfToken;
        return payload.csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = undefined;
      });
  }

  return csrfTokenPromise;
}

function clearCsrfToken() {
  csrfTokenCache = undefined;
  csrfTokenPromise = undefined;
}

function shouldSendCsrf(path: string, method: string) {
  return unsafeMethods.has(method.toUpperCase()) && !csrfExemptPaths.has(path);
}

function shouldRefreshCsrf(path: string, method: string) {
  return unsafeMethods.has(method.toUpperCase()) && path.startsWith('/api/auth/');
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function clientApiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: ClientApiOptions
) {
  const method = init?.method?.toUpperCase() ?? 'GET';

  async function runRequest(forceCsrfRefresh = false) {
    const headers = new Headers(init?.headers);

    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (options?.idempotent && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', createIdempotencyKey());
    }

    if (shouldSendCsrf(path, method)) {
      headers.set('X-CSRF-Token', await fetchCsrfToken(forceCsrfRefresh));
    }

    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers
    });

    return parseApiResponse<T>(response);
  }

  try {
    const payload = await runRequest(false);

    if (
      path === '/api/auth/logout' ||
      path === '/api/auth/logout-all' ||
      shouldRefreshCsrf(path, method)
    ) {
      clearCsrfToken();
    }

    return payload;
  } catch (error) {
    if (
      shouldSendCsrf(path, method) &&
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode?: number }).statusCode === 403
    ) {
      clearCsrfToken();
      return runRequest(true);
    }

    throw error;
  }
}
