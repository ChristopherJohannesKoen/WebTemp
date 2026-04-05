import http from 'k6/http';
import { check } from 'k6';

const appUrl = __ENV.APP_URL || 'http://localhost:3000';
const apiOrigin = __ENV.API_ORIGIN || 'http://localhost:4000';
const sessionCookieName = __ENV.SESSION_COOKIE_NAME || 'ultimate_template_session';
const ownerEmail = __ENV.SEED_OWNER_EMAIL || 'owner@example.com';
const ownerPassword = __ENV.SEED_OWNER_PASSWORD || 'ChangeMe123!';
const perfUserPassword = __ENV.PERF_USER_PASSWORD || 'ChangeMe123!';
const ensuredPerfUsers = new Set();

export function getAppUrl() {
  return appUrl;
}

export function getApiOrigin() {
  return apiOrigin;
}

export function createIdempotencyKey(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}`;
}

export function createFirstPartyHeaders(extraHeaders = {}) {
  return {
    Origin: appUrl,
    Referer: `${appUrl}/`,
    ...extraHeaders
  };
}

export function withExpectedStatuses(...statuses) {
  return {
    responseCallback: http.expectedStatuses(...statuses)
  };
}

function createAnonymousFirstPartyHeaders(extraHeaders = {}) {
  return createFirstPartyHeaders({
    Cookie: '',
    ...extraHeaders
  });
}

function clearApiCookieJar() {
  const jar = http.cookieJar();
  jar.clear(apiOrigin);
}

function readSessionCookie(response) {
  const responseCookie = response.cookies[sessionCookieName]?.[0]?.value;

  if (responseCookie) {
    return responseCookie;
  }

  const rawSetCookieHeader = response.headers['Set-Cookie'] ?? response.headers['set-cookie'];
  const rawHeaders = Array.isArray(rawSetCookieHeader)
    ? rawSetCookieHeader
    : rawSetCookieHeader
      ? [rawSetCookieHeader]
      : [];

  for (const header of rawHeaders) {
    const [cookiePair] = header.split(';');
    const [cookieName, ...cookieValueParts] = cookiePair.split('=');

    if (cookieName === sessionCookieName && cookieValueParts.length > 0) {
      return cookieValueParts.join('=');
    }
  }

  return undefined;
}

function getErrorSnippet(response) {
  const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
  return body.length > 300 ? `${body.slice(0, 300)}...` : body;
}

function requestLogin(email, password, params = {}) {
  clearApiCookieJar();

  return http.post(
    `${apiOrigin}/api/auth/login`,
    JSON.stringify({
      email,
      password
    }),
    {
      headers: createAnonymousFirstPartyHeaders({
        'Content-Type': 'application/json'
      }),
      ...withExpectedStatuses(200),
      ...params
    }
  );
}

function finalizeLogin(response, email) {
  check(response, {
    'login succeeded': (result) => result.status === 200
  });

  const cookie = readSessionCookie(response);

  if (!cookie) {
    throw new Error(
      `Login for ${email} did not yield ${sessionCookieName}. Status: ${response.status}. Body: ${getErrorSnippet(response)}`
    );
  }

  return cookie;
}

export function login(params = {}) {
  return finalizeLogin(requestLogin(ownerEmail, ownerPassword, params), ownerEmail);
}

export function getPerfUserCredentials(prefix = 'perf-user') {
  return {
    email: `k6+${prefix}-vu${__VU}@example.com`,
    name: `Perf ${prefix} VU ${__VU}`,
    password: perfUserPassword
  };
}

export function ensurePerfUser(prefix = 'perf-user') {
  if (ensuredPerfUsers.has(prefix)) {
    return getPerfUserCredentials(prefix);
  }

  const credentials = getPerfUserCredentials(prefix);
  clearApiCookieJar();

  const response = http.post(
    `${apiOrigin}/api/auth/signup`,
    JSON.stringify({
      email: credentials.email,
      name: credentials.name,
      password: credentials.password
    }),
    {
      headers: createAnonymousFirstPartyHeaders({
        'Content-Type': 'application/json',
        'Idempotency-Key': createIdempotencyKey(`signup-${prefix}`)
      }),
      ...withExpectedStatuses(201, 409),
      tags: {
        name: 'auth_signup_bootstrap'
      }
    }
  );

  check(response, {
    'perf user created or already exists': (result) =>
      result.status === 201 || result.status === 409
  });

  if (response.status !== 201 && response.status !== 409) {
    throw new Error(
      `Perf user bootstrap failed for ${credentials.email}. Status: ${response.status}. Body: ${getErrorSnippet(response)}`
    );
  }

  ensuredPerfUsers.add(prefix);

  return credentials;
}

export function loginPerfUser(prefix, params = {}) {
  const credentials = ensurePerfUser(prefix);
  return finalizeLogin(
    requestLogin(credentials.email, credentials.password, params),
    credentials.email
  );
}

export function fetchCsrfToken(sessionCookie) {
  const response = http.get(`${apiOrigin}/api/auth/csrf`, {
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookie}`
    },
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_csrf'
    }
  });

  check(response, {
    'csrf fetch succeeded': (result) => result.status === 200
  });

  return response.json('csrfToken');
}

export function createSessionHeaders(sessionCookie, csrfToken, extraHeaders = {}) {
  return createFirstPartyHeaders({
    Cookie: `${sessionCookieName}=${sessionCookie}`,
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...extraHeaders
  });
}

export function getSeedOwnerEmail() {
  return ownerEmail;
}

export function fetchMetricsText() {
  const response = http.get(`${apiOrigin}/api/metrics`, {
    ...withExpectedStatuses(200),
    tags: {
      name: 'metrics'
    }
  });

  check(response, {
    'metrics endpoint succeeded': (result) => result.status === 200
  });

  return response.body;
}

export function getPrometheusCounterValue(metricsText, metricName, labels = {}) {
  const labelEntries = Object.entries(labels);
  const lines = metricsText.split('\n');

  for (const line of lines) {
    if (!line.startsWith(metricName)) {
      continue;
    }

    const [metricDeclaration, rawValue] = line.split(' ');

    if (!rawValue) {
      continue;
    }

    if (labelEntries.length === 0 && !metricDeclaration.includes('{')) {
      return Number(rawValue);
    }

    const labelsMatch = metricDeclaration.match(/\{(.+)\}/);

    if (!labelsMatch) {
      continue;
    }

    const labelString = labelsMatch[1] ?? '';
    const matchesAllLabels = labelEntries.every(
      ([key, value]) => labelString.includes(`${key}="${value}"`)
    );

    if (matchesAllLabels) {
      return Number(rawValue);
    }
  }

  return 0;
}
