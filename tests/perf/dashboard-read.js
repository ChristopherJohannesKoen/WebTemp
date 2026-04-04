import http from 'k6/http';
import { check, sleep } from 'k6';
import { createSessionHeaders, getAppUrl, login } from './shared.js';

export const options = {
  scenarios: {
    dashboard_reads: {
      executor: 'constant-vus',
      vus: 10,
      duration: '45s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<900']
  }
};

export default function () {
  const sessionCookie = login();
  const headers = createSessionHeaders(sessionCookie);

  const dashboardResponse = http.get(`${getAppUrl()}/app`, { headers });
  check(dashboardResponse, {
    'dashboard page loads': (response) => response.status === 200
  });

  const projectsResponse = http.get(`${getAppUrl()}/app/projects`, { headers });
  check(projectsResponse, {
    'projects page loads': (response) => response.status === 200
  });

  sleep(1);
}
