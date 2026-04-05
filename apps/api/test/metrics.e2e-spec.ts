import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ObservabilityModule } from '../src/modules/observability/observability.module';
import { MetricsService } from '../src/modules/observability/metrics.service';

describe('MetricsController (e2e)', () => {
  let app: INestApplication;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule]
    }).compile();

    app = moduleRef.createNestApplication();
    metricsService = app.get(MetricsService);
    metricsService.recordAuthEvent('login_success');
    metricsService.recordSessionEvent('created');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('serves Prometheus text metrics', async () => {
    const response = await request(app.getHttpServer()).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('ultimate_template_auth_events_total');
    expect(response.text).toContain('ultimate_template_session_events_total');
  });
});
