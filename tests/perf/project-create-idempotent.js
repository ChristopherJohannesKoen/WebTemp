import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  createIdempotencyKey,
  createSessionHeaders,
  fetchCsrfToken,
  getApiOrigin,
  login
} from './shared.js';

export const options = {
  scenarios: {
    idempotent_writes: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200']
  }
};

export default function () {
  const sessionCookie = login();
  const csrfToken = fetchCsrfToken(sessionCookie);
  const idempotencyKey = createIdempotencyKey('project-create');
  const headers = createSessionHeaders(sessionCookie, csrfToken, {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey
  });
  const payload = JSON.stringify({
    name: `Perf project ${__VU}-${__ITER}`,
    description: 'k6 write path validation',
    status: 'active',
    isArchived: false
  });

  const firstResponse = http.post(`${getApiOrigin()}/api/projects`, payload, { headers });
  const replayResponse = http.post(`${getApiOrigin()}/api/projects`, payload, { headers });

  check(firstResponse, {
    'first create accepted': (response) => response.status === 201
  });
  check(replayResponse, {
    'replay create accepted': (response) =>
      response.status === 201 && response.json('id') === firstResponse.json('id')
  });

  sleep(1);
}
