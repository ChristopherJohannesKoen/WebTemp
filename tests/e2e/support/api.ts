import type { Role } from '@packages/shared';
import { getE2EEnv } from './e2e-env';

type Credentials = {
  email: string;
  password: string;
};

type SessionAuth = {
  csrfToken: string;
  sessionCookie: string;
};

const { API_ORIGIN } = getE2EEnv();
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'ultimate_template_session';

function getCookieHeader(response: Response) {
  const setCookieHeader = response.headers.get('set-cookie');
  const matchedCookie = setCookieHeader?.match(new RegExp(`${sessionCookieName}=([^;]+)`));

  if (!matchedCookie?.[1]) {
    throw new Error(`Missing ${sessionCookieName} cookie.`);
  }

  return `${sessionCookieName}=${matchedCookie[1]}`;
}

async function parseJson(response: Response) {
  const text = await response.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export async function loginViaApi(credentials: Credentials): Promise<SessionAuth> {
  const loginResponse = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`);
  }

  const sessionCookie = getCookieHeader(loginResponse);
  const csrfResponse = await fetch(`${API_ORIGIN}/api/auth/csrf`, {
    headers: {
      cookie: sessionCookie
    }
  });

  if (!csrfResponse.ok) {
    throw new Error(`CSRF fetch failed: ${csrfResponse.status}`);
  }

  const csrfPayload = (await parseJson(csrfResponse)) as { csrfToken?: string };

  if (!csrfPayload.csrfToken) {
    throw new Error('Missing csrf token.');
  }

  return {
    csrfToken: csrfPayload.csrfToken,
    sessionCookie
  };
}

export async function updateUserRoleViaApi(auth: SessionAuth, userId: string, role: Role) {
  const response = await fetch(`${API_ORIGIN}/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: auth.sessionCookie,
      'x-csrf-token': auth.csrfToken
    },
    body: JSON.stringify({ role })
  });

  return {
    status: response.status,
    body: await parseJson(response)
  };
}
