import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry
} from 'prom-client';

type HttpRequestMetric = {
  method: string;
  route?: string | null;
  statusCode: number;
  durationMs: number;
};

type IdempotencyCleanupMetric = {
  source: 'startup' | 'scheduled';
  deletedCount: number;
  durationMs: number;
  remainingExpired: number;
};

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal = new Counter({
    name: 'ultimate_template_http_requests_total',
    help: 'HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry]
  });
  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'ultimate_template_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry]
  });
  private readonly authEventsTotal = new Counter({
    name: 'ultimate_template_auth_events_total',
    help: 'Authentication and password-reset lifecycle events.',
    labelNames: ['event'],
    registers: [this.registry]
  });
  private readonly sessionEventsTotal = new Counter({
    name: 'ultimate_template_session_events_total',
    help: 'Session lifecycle events.',
    labelNames: ['event'],
    registers: [this.registry]
  });
  private readonly securityEventsTotal = new Counter({
    name: 'ultimate_template_security_events_total',
    help: 'Security boundary events such as CSRF and origin validation failures.',
    labelNames: ['event'],
    registers: [this.registry]
  });
  private readonly ownershipEventsTotal = new Counter({
    name: 'ultimate_template_ownership_events_total',
    help: 'Ownership bootstrap and owner-floor lifecycle events.',
    labelNames: ['event'],
    registers: [this.registry]
  });
  private readonly idempotencyEventsTotal = new Counter({
    name: 'ultimate_template_idempotency_events_total',
    help: 'Idempotency request lifecycle events.',
    labelNames: ['event'],
    registers: [this.registry]
  });
  private readonly idempotencyCleanupDurationSeconds = new Histogram({
    name: 'ultimate_template_idempotency_cleanup_duration_seconds',
    help: 'Duration of scheduled idempotency cleanup runs.',
    labelNames: ['source'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [this.registry]
  });
  private readonly idempotencyCleanupDeletedTotal = new Counter({
    name: 'ultimate_template_idempotency_cleanup_deleted_total',
    help: 'Expired idempotency records deleted by cleanup runs.',
    labelNames: ['source'],
    registers: [this.registry]
  });
  private readonly idempotencyExpiredBacklog = new Gauge({
    name: 'ultimate_template_idempotency_expired_backlog',
    help: 'Expired idempotency rows remaining after the last cleanup run.',
    registers: [this.registry]
  });

  constructor() {
    collectDefaultMetrics({
      prefix: 'ultimate_template_process_',
      register: this.registry
    });
  }

  observeHttpRequest(metric: HttpRequestMetric) {
    const labels = {
      method: metric.method.toUpperCase(),
      route: this.normalizeRoute(metric.route),
      status_code: String(metric.statusCode)
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, metric.durationMs / 1000);
  }

  recordAuthEvent(event: string) {
    this.authEventsTotal.inc({ event });
  }

  recordSessionEvent(event: string) {
    this.sessionEventsTotal.inc({ event });
  }

  recordSecurityEvent(event: string) {
    this.securityEventsTotal.inc({ event });
  }

  recordOwnershipEvent(event: string) {
    this.ownershipEventsTotal.inc({ event });
  }

  recordIdempotencyEvent(event: string) {
    this.idempotencyEventsTotal.inc({ event });
  }

  observeIdempotencyCleanup(metric: IdempotencyCleanupMetric) {
    this.idempotencyCleanupDurationSeconds.observe(
      { source: metric.source },
      metric.durationMs / 1000
    );
    this.idempotencyCleanupDeletedTotal.inc(
      { source: metric.source },
      metric.deletedCount
    );
    this.idempotencyExpiredBacklog.set(metric.remainingExpired);
  }

  getMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }

  private normalizeRoute(route?: string | null) {
    return route?.trim() ? route : 'unmatched';
  }
}
