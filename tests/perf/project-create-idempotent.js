import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  createIdempotencyKey,
  createSessionHeaders,
  ensurePerfUser,
  fetchCsrfToken,
  getApiOrigin,
  loginPerfUser,
  withExpectedStatuses
} from './shared.js';

let cachedSessionCookie;
let cachedCsrfToken;

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
    'http_req_duration{name:projects_create}': ['p(95)<900']
  }
};

export default function () {
  if (!cachedSessionCookie) {
    ensurePerfUser('idempotent-project-create');
    cachedSessionCookie = loginPerfUser('idempotent-project-create');
    cachedCsrfToken = fetchCsrfToken(cachedSessionCookie);
  }

  const sessionCookie = cachedSessionCookie;
  const csrfToken = cachedCsrfToken;
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

  const firstResponse = http.post(`${getApiOrigin()}/api/projects`, payload, {
    headers,
    ...withExpectedStatuses(201),
    tags: {
      name: 'projects_create'
    }
  });
  const replayResponse = http.post(`${getApiOrigin()}/api/projects`, payload, {
    headers,
    ...withExpectedStatuses(201),
    tags: {
      name: 'projects_create'
    }
  });

  check(firstResponse, {
    'first create accepted': (response) => response.status === 201
  });
  check(replayResponse, {
    'replay create accepted': (response) =>
      response.status === 201 && response.json('id') === firstResponse.json('id')
  });

  sleep(1);
}
