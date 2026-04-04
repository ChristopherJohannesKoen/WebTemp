import http from 'k6/http';
import { check, sleep } from 'k6';
import { createSessionHeaders, fetchCsrfToken, getApiOrigin, login } from './shared.js';

export const options = {
  scenarios: {
    churn: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },
        { duration: '30s', target: 15 },
        { duration: '15s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1000']
  }
};

export default function () {
  const sessionCookie = login();
  const csrfToken = fetchCsrfToken(sessionCookie);

  const meResponse = http.get(`${getApiOrigin()}/api/auth/me`, {
    headers: createSessionHeaders(sessionCookie)
  });
  check(meResponse, {
    'session is readable': (response) => response.status === 200
  });

  const sessionsResponse = http.get(`${getApiOrigin()}/api/auth/sessions`, {
    headers: createSessionHeaders(sessionCookie)
  });
  check(sessionsResponse, {
    'sessions list is readable': (response) => response.status === 200
  });

  const logoutResponse = http.post(`${getApiOrigin()}/api/auth/logout`, null, {
    headers: createSessionHeaders(sessionCookie, csrfToken)
  });
  check(logoutResponse, {
    'logout completes': (response) => response.status === 200
  });

  sleep(1);
}
