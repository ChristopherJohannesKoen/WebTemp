import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { initializeOpenTelemetry } from '../src/modules/observability/otel.bootstrap';

function createConfigService(overrides: Record<string, string | boolean>) {
  return {
    get: vi.fn((key: string, defaultValue?: string | boolean) => overrides[key] ?? defaultValue)
  };
}

describe('initializeOpenTelemetry', () => {
  it('does nothing when observability is disabled', async () => {
    const configService = createConfigService({
      FEATURE_OBSERVABILITY: false
    });

    await expect(initializeOpenTelemetry(configService as never)).resolves.toBeUndefined();
  });

  it('fails fast when observability is enabled without an exporter endpoint', async () => {
    const configService = createConfigService({
      FEATURE_OBSERVABILITY: 'true'
    });

    await expect(initializeOpenTelemetry(configService as never)).rejects.toThrow(
      'FEATURE_OBSERVABILITY is enabled but OTEL_EXPORTER_OTLP_ENDPOINT is missing.'
    );
  });
});
