import type { ConfigService } from '@nestjs/config';

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

export function parseAllowedOrigins(rawOrigins: Array<string | undefined | null>) {
  return [
    ...new Set(rawOrigins.filter((value): value is string => Boolean(value)).map(normalizeOrigin))
  ];
}

export function getAllowedOrigins(configService: ConfigService) {
  const extraOrigins = (configService.get<string>('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parseAllowedOrigins([
    configService.get<string>('APP_URL'),
    configService.get<string>('API_ORIGIN'),
    ...extraOrigins
  ]);
}
