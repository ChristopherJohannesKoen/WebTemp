import http from 'k6/http';
import { check, sleep } from 'k6';
import { createSessionHeaders, fetchCsrfToken, getApiOrigin, login } from './shared.js';

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750']
  }
};

export default function () {
  const sessionCookie = login();
  const csrfToken = fetchCsrfToken(sessionCookie);

  const healthResponse = http.get(`${getApiOrigin()}/api/health`);
  check(healthResponse, {
    'health is healthy': (response) => response.status === 200
  });

  const meResponse = http.get(`${getApiOrigin()}/api/auth/me`, {
    headers: createSessionHeaders(sessionCookie)
  });
  check(meResponse, {
    'me endpoint works': (response) => response.status === 200
  });

  const logoutResponse = http.post(
    `${getApiOrigin()}/api/auth/logout`,
    null,
    {
      headers: createSessionHeaders(sessionCookie, csrfToken)
    }
  );
  check(logoutResponse, {
    'logout works': (response) => response.status === 200
  });

  sleep(1);
}
