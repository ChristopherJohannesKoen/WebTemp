import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  createSessionHeaders,
  ensurePerfUser,
  fetchCsrfToken,
  fetchMetricsText,
  getApiOrigin,
  getPrometheusCounterValue,
  loginPerfUser,
  withExpectedStatuses
} from './shared.js';

const sessionTouchRatioOk = new Rate('session_touch_ratio_ok');

export const options = {
  scenarios: {
    churn: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 3
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:auth_login}': ['p(95)<500'],
    'http_req_duration{name:auth_me}': ['p(95)<300'],
    'http_req_duration{name:auth_sessions}': ['p(95)<300'],
    'http_req_duration{name:auth_revoke}': ['p(95)<700'],
    'http_req_duration{name:auth_logout_all}': ['p(95)<700'],
    session_touch_ratio_ok: ['rate>0.99']
  }
};

export default function () {
  ensurePerfUser('auth-session-churn');

  const sessionCookie = loginPerfUser('auth-session-churn', {
    tags: {
      name: 'auth_login'
    }
  });
  const csrfToken = fetchCsrfToken(sessionCookie);
  const baselineMetrics = fetchMetricsText();
  const baselineTouches = getPrometheusCounterValue(
    baselineMetrics,
    'ultimate_template_session_events_total',
    { event: 'touched' }
  );

  for (let index = 0; index < 5; index += 1) {
    const meResponse = http.get(`${getApiOrigin()}/api/auth/me`, {
      headers: createSessionHeaders(sessionCookie),
      ...withExpectedStatuses(200),
      tags: {
        name: 'auth_me'
      }
    });
    check(meResponse, {
      'session is readable': (response) => response.status === 200
    });

    const sessionsResponse = http.get(`${getApiOrigin()}/api/auth/sessions`, {
      headers: createSessionHeaders(sessionCookie),
      ...withExpectedStatuses(200),
      tags: {
        name: 'auth_sessions'
      }
    });
    check(sessionsResponse, {
      'sessions list is readable': (response) => response.status === 200
    });
  }

  const secondSessionCookie = loginPerfUser('auth-session-churn', {
    tags: {
      name: 'auth_login'
    }
  });
  const sessionsBeforeLogoutAll = http.get(`${getApiOrigin()}/api/auth/sessions`, {
    headers: createSessionHeaders(sessionCookie),
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_sessions'
    }
  });
  const secondSessionId = sessionsBeforeLogoutAll
    .json('items')
    .find((entry) => !entry.isCurrent)?.id;

  if (secondSessionId) {
    const revokeResponse = http.del(
      `${getApiOrigin()}/api/auth/sessions/${secondSessionId}`,
      null,
      {
        headers: createSessionHeaders(sessionCookie, csrfToken),
        ...withExpectedStatuses(200),
        tags: {
          name: 'auth_revoke'
        }
      }
    );
    check(revokeResponse, {
      'session revoke succeeds': (response) => response.status === 200
    });
  }

  const logoutAllResponse = http.post(`${getApiOrigin()}/api/auth/logout-all`, null, {
    headers: createSessionHeaders(sessionCookie, csrfToken),
    ...withExpectedStatuses(200),
    tags: {
      name: 'auth_logout_all'
    }
  });
  check(logoutAllResponse, {
    'logout all completes': (response) => response.status === 200
  });

  const postBurstMetrics = fetchMetricsText();
  const touchedAfterBurst = getPrometheusCounterValue(
    postBurstMetrics,
    'ultimate_template_session_events_total',
    { event: 'touched' }
  );
  sessionTouchRatioOk.add(touchedAfterBurst - baselineTouches <= 1);

  const revokedSessionProbe = http.get(`${getApiOrigin()}/api/auth/me`, {
    headers: createSessionHeaders(secondSessionCookie),
    ...withExpectedStatuses(401),
    tags: {
      name: 'auth_me'
    }
  });
  check(revokedSessionProbe, {
    'revoked secondary session is rejected': (response) => response.status === 401
  });

  sleep(1);
}
