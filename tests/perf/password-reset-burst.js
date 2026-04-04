import http from 'k6/http';
import { check, sleep } from 'k6';
import { getApiOrigin, getSeedOwnerEmail } from './shared.js';

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
    http_req_duration: ['p(95)<800']
  }
};

export default function () {
  const response = http.post(
    `${getApiOrigin()}/api/auth/password/forgot`,
    JSON.stringify({
      email: getSeedOwnerEmail()
    }),
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  check(response, {
    'reset request accepted': (result) => result.status === 200
  });

  sleep(0.5);
}
