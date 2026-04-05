import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const cspReportUri = process.env.CSP_REPORT_URI?.trim();

function readBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function buildContentSecurityPolicy(nonce: string, options?: { reportOnly?: boolean }) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const connectSources = ["'self'", apiOrigin];
  const styleSources = options?.reportOnly
    ? [`'self'`, `'nonce-${nonce}'`]
    : ["'self'", "'unsafe-inline'"];

  if (isDevelopment) {
    connectSources.push('ws:', 'wss:');
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src ${styleSources.join(' ')}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "manifest-src 'self'"
  ];

  if (options?.reportOnly && cspReportUri) {
    directives.push(`report-uri ${cspReportUri}`);
  }

  return directives.join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const reportOnlyPolicy = readBooleanEnv(process.env.CSP_REPORT_ONLY)
    ? buildContentSecurityPolicy(nonce, { reportOnly: true })
    : undefined;

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  if (reportOnlyPolicy) {
    response.headers.set('Content-Security-Policy-Report-Only', reportOnlyPolicy);
  }
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), midi=(), payment=(), usb=(), browsing-topics=()'
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
};
