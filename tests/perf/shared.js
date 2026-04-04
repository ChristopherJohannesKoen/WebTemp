import http from 'k6/http';
import { check } from 'k6';

const appUrl = __ENV.APP_URL || 'http://127.0.0.1:3000';
const apiOrigin = __ENV.API_ORIGIN || 'http://127.0.0.1:4000';
const sessionCookieName = __ENV.SESSION_COOKIE_NAME || 'ultimate_template_session';
const ownerEmail = __ENV.SEED_OWNER_EMAIL || 'owner@example.com';
const ownerPassword = __ENV.SEED_OWNER_PASSWORD || 'ChangeMe123!';

export function getAppUrl() {
  return appUrl;
}

export function getApiOrigin() {
  return apiOrigin;
}

export function createIdempotencyKey(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}`;
}

export function login() {
  const response = http.post(
    `${apiOrigin}/api/auth/login`,
    JSON.stringify({
      email: ownerEmail,
      password: ownerPassword
    }),
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  check(response, {
    'login succeeded': (result) => result.status === 200
  });

  const cookie = response.cookies[sessionCookieName]?.[0]?.value;

  if (!cookie) {
    throw new Error(`Missing ${sessionCookieName} cookie after login.`);
  }

  return cookie;
}

export function fetchCsrfToken(sessionCookie) {
  const response = http.get(`${apiOrigin}/api/auth/csrf`, {
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookie}`
    }
  });

  check(response, {
    'csrf fetch succeeded': (result) => result.status === 200
  });

  return response.json('csrfToken');
}

export function createSessionHeaders(sessionCookie, csrfToken, extraHeaders = {}) {
  return {
    Cookie: `${sessionCookieName}=${sessionCookie}`,
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...extraHeaders
  };
}

export function getSeedOwnerEmail() {
  return ownerEmail;
}
