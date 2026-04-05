type CspOptions = {
  apiOrigin: string;
  environment: string | undefined;
  nonce: string;
  reportOnly?: boolean;
  reportUri?: string;
  styleHashes?: string[];
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function readBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

export function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function getStyleSources({
  environment,
  nonce,
  reportOnly = false,
  styleHashes = []
}: Pick<CspOptions, 'environment' | 'nonce' | 'styleHashes'> & { reportOnly?: boolean }) {
  if (environment === 'development' && !reportOnly) {
    return ["'self'", "'unsafe-inline'"];
  }

  return unique(["'self'", `'nonce-${nonce}'`, ...styleHashes]);
}

export function buildContentSecurityPolicy({
  apiOrigin,
  environment,
  nonce,
  reportOnly = false,
  reportUri,
  styleHashes
}: CspOptions) {
  const isDevelopment = environment === 'development';
  const connectSources = unique(["'self'", apiOrigin, ...(isDevelopment ? ['ws:', 'wss:'] : [])]);
  const resolvedStyleSources = getStyleSources({
    environment,
    nonce,
    reportOnly,
    styleHashes
  });

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src ${resolvedStyleSources.join(' ')}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "manifest-src 'self'"
  ];

  if (reportOnly && reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join('; ');
}
