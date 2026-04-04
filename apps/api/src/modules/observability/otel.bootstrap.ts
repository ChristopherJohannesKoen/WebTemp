import { ConfigService } from '@nestjs/config';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { readBooleanConfig } from '../../common/config/boolean-config';

export async function initializeOpenTelemetry(configService: ConfigService) {
  if (
    !readBooleanConfig(
      configService.get<string | boolean>('FEATURE_OBSERVABILITY', false),
      false
    )
  ) {
    return undefined;
  }

  const url = configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT');

  if (!url) {
    throw new Error(
      'FEATURE_OBSERVABILITY is enabled but OTEL_EXPORTER_OTLP_ENDPOINT is missing.'
    );
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  await sdk.start();
  console.info(
    JSON.stringify({
      level: 'info',
      message: 'observability.otel.started',
      exporter: 'otlp-http',
      endpoint: url
    })
  );

  return sdk;
}
