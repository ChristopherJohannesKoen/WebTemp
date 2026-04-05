export const appEnvironmentValues = ['local', 'test', 'staging', 'production'] as const;

export type AppEnvironment = (typeof appEnvironmentValues)[number];

export function deriveAppEnvironment(nodeEnvironment: string | undefined): AppEnvironment {
  switch (nodeEnvironment) {
    case 'test':
      return 'test';
    case 'production':
      return 'production';
    default:
      return 'local';
  }
}

export function normalizeAppEnvironment(
  rawAppEnvironment: unknown,
  nodeEnvironment: string | undefined
): AppEnvironment {
  if (typeof rawAppEnvironment === 'string' && appEnvironmentValues.includes(rawAppEnvironment as AppEnvironment)) {
    return rawAppEnvironment as AppEnvironment;
  }

  return deriveAppEnvironment(nodeEnvironment);
}

export function isLocalAppEnvironment(appEnvironment: AppEnvironment) {
  return appEnvironment === 'local';
}

export function isTestAppEnvironment(appEnvironment: AppEnvironment) {
  return appEnvironment === 'test';
}

export function canAllowMissingOrigin(appEnvironment: AppEnvironment) {
  return isLocalAppEnvironment(appEnvironment);
}

export function canExposeResetDetails(appEnvironment: AppEnvironment) {
  return isLocalAppEnvironment(appEnvironment) || isTestAppEnvironment(appEnvironment);
}
