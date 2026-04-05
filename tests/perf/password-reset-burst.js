import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  createFirstPartyHeaders,
  getApiOrigin,
  getSeedOwnerEmail,
  withExpectedStatuses
} from './shared.js';

export const options = {
  scenarios: {
    reset_burst: {
      executor: 'constant-arrival-rate',
      rate: 8,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 8,
      maxVUs: 20
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{name:auth_password_reset_request}': ['p(95)<800']
  }
};

export default function () {
  const response = http.post(
    `${getApiOrigin()}/api/auth/password/forgot`,
    JSON.stringify({
      email: getSeedOwnerEmail()
    }),
    {
      headers: createFirstPartyHeaders({
        'Content-Type': 'application/json'
      }),
      ...withExpectedStatuses(200),
      tags: {
        name: 'auth_password_reset_request'
      }
    }
  );

  check(response, {
    'reset request accepted': (result) => result.status === 200
  });

  sleep(0.5);
}
