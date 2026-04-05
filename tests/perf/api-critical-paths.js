import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  createSessionHeaders,
  fetchCsrfToken,
  getApiOrigin,
  loginPerfUser,
  withExpectedStatuses
} from './shared.js';

export const options = {
  scenarios: {
    critical_api_paths: {
      executor: 'constant-vus',
      vus: 4,
      duration: '45s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:auth_login}': ['p(95)<500'],
    'http_req_duration{name:auth_me}': ['p(95)<300'],
    'http_req_duration{name:auth_sessions}': ['p(95)<300'],
    'http_req_duration{name:auth_revoke}': ['p(95)<700'],
    'http_req_duration{name:auth_logout_all}': ['p(95)<700'],
    'http_req_duration{name:projects_list}': ['p(95)<500'],
    'http_req_duration{name:projects_get}': ['p(95)<500']
  }
};

export default function () {
  const primarySessionCookie = loginPerfUser('critical-api', {
    tags: {
      name: 'auth_login'
    }
  });
  const csrfToken = fetchCsrfToken(primarySessionCookie);
  const secondarySessionCookie = loginPerfUser('critical-api', {
    tags: {
      name: 'auth_login'
    }
  });

  const meResponse = http.get(`${getApiOrigin()}/api/auth/me`, {
    headers: createSessionHeaders(primarySessionCookie),
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_me'
    }
  });
  check(meResponse, {
    'auth/me returns 200': (response) => response.status === 200
  });

  const sessionsResponse = http.get(`${getApiOrigin()}/api/auth/sessions`, {
    headers: createSessionHeaders(primarySessionCookie),
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_sessions'
    }
  });
  check(sessionsResponse, {
    'auth/sessions returns 200': (response) => response.status === 200
  });

  const secondSessionId = sessionsResponse
    .json('items')
    .find((entry) => !entry.isCurrent)?.id;

  if (secondSessionId) {
    const revokeResponse = http.del(
      `${getApiOrigin()}/api/auth/sessions/${secondSessionId}`,
      null,
      {
        headers: createSessionHeaders(primarySessionCookie, csrfToken),
        ...withExpectedStatuses(200),
        tags: {
          name: 'auth_revoke'
        }
      }
    );
    check(revokeResponse, {
      'auth/sessions revoke returns 200': (response) => response.status === 200
    });
  }

  const projectsResponse = http.get(`${getApiOrigin()}/api/projects?limit=12`, {
    headers: createSessionHeaders(primarySessionCookie),
    ...withExpectedStatuses(200),
    tags: {
      name: 'projects_list'
    }
  });
  check(projectsResponse, {
    'projects list returns 200': (response) => response.status === 200
  });

  const projectId = projectsResponse.json('items.0.id');

  if (projectId) {
    const projectResponse = http.get(`${getApiOrigin()}/api/projects/${projectId}`, {
      headers: createSessionHeaders(primarySessionCookie),
      ...withExpectedStatuses(200),
      tags: {
        name: 'projects_get'
      }
    });
    check(projectResponse, {
      'projects get returns 200': (response) => response.status === 200
    });
  }

  const logoutAllResponse = http.post(`${getApiOrigin()}/api/auth/logout-all`, null, {
    headers: createSessionHeaders(primarySessionCookie, csrfToken),
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_logout_all'
    }
  });
  check(logoutAllResponse, {
    'logout all returns 200': (response) => response.status === 200
  });

  const revokedProbe = http.get(`${getApiOrigin()}/api/auth/me`, {
    headers: createSessionHeaders(secondarySessionCookie),
    ...withExpectedStatuses(401),
    tags: {
      name: 'auth_me'
    }
  });
  check(revokedProbe, {
    'secondary session is rejected after logout all': (response) => response.status === 401
  });

  sleep(1);
}
