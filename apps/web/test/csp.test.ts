import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '../lib/csp';

describe('content security policy', () => {
  it('enforces nonce-based styles in production without unsafe-inline', () => {
    const policy = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      environment: 'production',
      nonce: 'nonce-value'
    });

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-nonce-value'");
    expect(policy).not.toContain("'unsafe-inline'");
  });

  it('keeps development-only style relaxations out of production policy', () => {
    const policy = buildContentSecurityPolicy({
      apiOrigin: 'http://localhost:4000',
      environment: 'development',
      nonce: 'nonce-value'
    });

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain('connect-src');
  });
});
