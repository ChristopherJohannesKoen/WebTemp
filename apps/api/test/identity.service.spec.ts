import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createRemoteJWKSetMock, jwtVerifyMock } = vi.hoisted(() => ({
  createRemoteJWKSetMock: vi.fn(() => 'jwks-set'),
  jwtVerifyMock: vi.fn()
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  jwtVerify: jwtVerifyMock
}));

import { IdentityService } from '../src/modules/identity/identity.service';

function createProvider(
  overrides: Partial<{
    id: string;
    slug: string;
    displayName: string;
    type: 'oidc' | 'saml';
    status: 'staged' | 'active' | 'disabled';
    issuer: string | null;
    authorizationEndpoint: string | null;
    tokenEndpoint: string | null;
    jwksUri: string | null;
    clientId: string | null;
    clientSecretRef: string | null;
    scopes: string[];
    samlSsoUrl: string | null;
    samlEntityId: string | null;
    samlCertificatePem: string | null;
    verifiedDomains: string[];
    groupClaim: string | null;
    emailClaim: string | null;
    subjectClaim: string | null;
    scimBearerTokenRef: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? 'provider_1',
    slug: overrides.slug ?? 'enterprise-oidc',
    displayName: overrides.displayName ?? 'Acme SSO',
    type: overrides.type ?? 'oidc',
    status: overrides.status ?? 'active',
    issuer: overrides.issuer ?? 'https://idp.example.com',
    authorizationEndpoint:
      overrides.authorizationEndpoint ?? 'https://idp.example.com/oauth2/v1/authorize',
    tokenEndpoint: overrides.tokenEndpoint ?? 'https://idp.example.com/oauth2/v1/token',
    jwksUri: overrides.jwksUri ?? 'https://idp.example.com/oauth2/v1/keys',
    clientId: overrides.clientId ?? 'client-id',
    clientSecretRef: overrides.clientSecretRef ?? 'OIDC_CLIENT_SECRET',
    scopes: overrides.scopes ?? ['openid', 'profile', 'email'],
    samlSsoUrl: overrides.samlSsoUrl ?? null,
    samlEntityId: overrides.samlEntityId ?? null,
    samlCertificatePem: overrides.samlCertificatePem ?? null,
    verifiedDomains: overrides.verifiedDomains ?? ['example.com'],
    groupClaim: overrides.groupClaim ?? 'groups',
    emailClaim: overrides.emailClaim ?? 'email',
    subjectClaim: overrides.subjectClaim ?? 'sub',
    scimBearerTokenRef: overrides.scimBearerTokenRef ?? null
  };
}

function createService(configOverrides: Record<string, string> = {}) {
  const prismaService = {
    identityProviderConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn()
    },
    userGroup: {
      upsert: vi.fn(),
      findMany: vi.fn()
    },
    groupRoleMapping: {
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    accessPolicyEvent: {
      create: vi.fn()
    },
    userIdentity: {
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  };

  const configService = {
    get: vi.fn((key: string, defaultValue?: string) => configOverrides[key] ?? defaultValue)
  };
  const sessionService = {
    createSession: vi.fn().mockResolvedValue({
      token: 'session-token',
      expiresAt: new Date('2026-04-05T00:00:00.000Z')
    })
  };
  const secretService = {
    getRequiredSecret: vi.fn((key: string) => {
      if (key === 'SESSION_COOKIE_ENCRYPTION_KEY' || key === 'SSO_STATE_ENCRYPTION_KEY') {
        return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      }

      if (key === 'OIDC_CLIENT_SECRET') {
        return 'super-secret';
      }

      if (key === 'SCIM_BEARER_TOKEN') {
        return 'scim-secret';
      }

      return '';
    }),
    getOptionalSecret: vi.fn((key: string) => {
      if (key === 'SSO_STATE_ENCRYPTION_KEY') {
        return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      }

      return undefined;
    })
  };
  const auditService = {
    log: vi.fn().mockResolvedValue(undefined)
  };
  const metricsService = {
    recordIdentityEvent: vi.fn()
  };
  const requestContextService = {
    get: vi.fn().mockReturnValue({
      requestId: 'request_1',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest'
    })
  };

  const service = new IdentityService(
    prismaService as never,
    configService as never,
    sessionService as never,
    secretService as never,
    auditService as never,
    metricsService as never,
    requestContextService as never
  );

  return {
    service,
    prismaService,
    configService,
    sessionService,
    secretService,
    auditService,
    metricsService
  };
}

describe('IdentityService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    createRemoteJWKSetMock.mockClear();
    jwtVerifyMock.mockReset();
  });

  it('returns an explicit login policy with the default OIDC provider first', async () => {
    const { service, prismaService } = createService({
      ENTERPRISE_IDENTITY_ENABLED: 'true',
      ENTERPRISE_DEFAULT_PROVIDER_SLUG: 'enterprise-oidc',
      APP_ENV: 'production',
      NODE_ENV: 'production'
    });

    prismaService.identityProviderConfig.findMany.mockResolvedValue([
      createProvider({
        id: 'provider_saml',
        slug: 'enterprise-saml',
        displayName: 'Fallback SAML',
        type: 'saml',
        issuer: null,
        authorizationEndpoint: null,
        tokenEndpoint: null,
        jwksUri: null,
        clientId: null,
        clientSecretRef: null,
        scopes: [],
        samlSsoUrl: 'https://idp.example.com/saml',
        samlEntityId: 'urn:acme:idp',
        samlCertificatePem: '-----BEGIN CERTIFICATE-----fake-----END CERTIFICATE-----'
      }),
      createProvider({
        id: 'provider_oidc',
        slug: 'enterprise-oidc',
        displayName: 'Acme SSO'
      })
    ]);

    const result = await service.listProviders();

    expect(result.defaultProviderSlug).toBe('enterprise-oidc');
    expect(result.providers.map((provider) => provider.slug)).toEqual([
      'enterprise-oidc',
      'enterprise-saml'
    ]);
    expect(result.localAuthEnabled).toBe(false);
    expect(result.breakGlassEnabled).toBe(false);
  });

  it('starts an OIDC login flow with PKCE and the provider callback URL', async () => {
    const { service, prismaService, metricsService, auditService } = createService({
      APP_URL: 'http://localhost:3000'
    });

    prismaService.identityProviderConfig.findUnique.mockResolvedValue(
      createProvider({
        id: 'provider_oidc',
        slug: 'enterprise-oidc'
      })
    );

    const result = await service.startLogin('enterprise-oidc', '/app/projects');
    const redirectUrl = new URL(result.redirectUrl);

    expect(redirectUrl.origin).toBe('https://idp.example.com');
    expect(redirectUrl.searchParams.get('client_id')).toBe('client-id');
    expect(redirectUrl.searchParams.get('response_type')).toBe('code');
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/sso/enterprise-oidc/callback'
    );
    expect(redirectUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBeTruthy();
    expect(metricsService.recordIdentityEvent).toHaveBeenCalledWith('oidc_login_started');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.sso_provider_started',
        metadata: expect.objectContaining({
          provider: 'enterprise-oidc',
          redirectTo: '/app/projects'
        })
      })
    );
  });

  it('completes an OIDC callback with a validated identity token', async () => {
    const { service, prismaService, sessionService, auditService, metricsService } = createService({
      APP_URL: 'http://localhost:3000'
    });
    const provider = createProvider({
      id: 'provider_oidc',
      slug: 'enterprise-oidc'
    });

    prismaService.identityProviderConfig.findUnique.mockResolvedValue(provider);
    prismaService.userIdentity.updateMany.mockResolvedValue({ count: 1 });
    vi.spyOn(
      service as unknown as {
        upsertEnterpriseUser: (...args: unknown[]) => Promise<unknown>;
      },
      'upsertEnterpriseUser'
    ).mockResolvedValue({
      id: 'user_enterprise',
      email: 'owner@example.com',
      name: 'Owner User',
      role: 'admin',
      disabledAt: null,
      provisionedBy: 'oidc'
    } as never);

    const startResult = await service.startLogin('enterprise-oidc', '/app/projects');
    const state = new URL(startResult.redirectUrl).searchParams.get('state');

    if (!state) {
      throw new Error('OIDC start flow did not include a state parameter.');
    }

    const decodedState = (
      service as unknown as {
        decryptState: (value: string) => { nonce?: string; verifier?: string };
      }
    ).decryptState(state);

    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: 'subject_123',
        email: 'owner@example.com',
        name: 'Owner User',
        groups: ['admins'],
        nonce: decodedState.nonce
      }
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id_token: 'id-token' }), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      )
    );

    const result = await service.handleOidcCallback(
      'enterprise-oidc',
      {
        state,
        code: 'authorization-code'
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(result.redirectTo).toBe('/app/projects');
    expect(result.user.identityProvider?.slug).toBe('enterprise-oidc');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      'user_enterprise',
      expect.objectContaining({
        authMethod: 'oidc',
        authReason: 'oidc_login',
        externalSubject: 'subject_123'
      })
    );
    expect(prismaService.userIdentity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: 'provider_oidc',
          externalSubject: 'subject_123'
        })
      })
    );
    expect(metricsService.recordIdentityEvent).toHaveBeenCalledWith('oidc_login_success');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.sso_login',
        authMechanism: 'oidc'
      })
    );
  });

  it('rejects invalid OIDC callback state and invalid token verification', async () => {
    const { service, prismaService } = createService({
      APP_URL: 'http://localhost:3000'
    });

    prismaService.identityProviderConfig.findUnique.mockResolvedValue(
      createProvider({
        id: 'provider_oidc',
        slug: 'enterprise-oidc'
      })
    );

    await expect(
      service.handleOidcCallback(
        'enterprise-oidc',
        {
          state: 'invalid-state',
          code: 'authorization-code'
        },
        {}
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const startResult = await service.startLogin('enterprise-oidc', '/app');
    const state = new URL(startResult.redirectUrl).searchParams.get('state');

    if (!state) {
      throw new Error('OIDC start flow did not include a state parameter.');
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id_token: 'id-token' }), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      )
    );
    jwtVerifyMock.mockRejectedValue(new Error('issuer mismatch'));

    await expect(
      service.handleOidcCallback(
        'enterprise-oidc',
        {
          state,
          code: 'authorization-code'
        },
        {}
      )
    ).rejects.toMatchObject({
      message: 'The OIDC identity token could not be validated.'
    });
  });

  it('rejects incomplete SAML callbacks and enforces SCIM bearer tokens', async () => {
    const { service, prismaService } = createService({
      APP_URL: 'http://localhost:3000',
      ENTERPRISE_DEFAULT_PROVIDER_SLUG: 'enterprise-oidc'
    });

    prismaService.identityProviderConfig.findUnique
      .mockResolvedValueOnce(
        createProvider({
          id: 'provider_saml',
          slug: 'enterprise-saml',
          type: 'saml',
          issuer: null,
          authorizationEndpoint: null,
          tokenEndpoint: null,
          jwksUri: null,
          clientId: null,
          clientSecretRef: null,
          scopes: [],
          samlSsoUrl: 'https://idp.example.com/saml',
          samlEntityId: 'urn:acme:idp',
          samlCertificatePem: '-----BEGIN CERTIFICATE-----fake-----END CERTIFICATE-----'
        })
      )
      .mockResolvedValueOnce(
        createProvider({
          id: 'provider_oidc',
          slug: 'enterprise-oidc',
          scimBearerTokenRef: 'SCIM_BEARER_TOKEN'
        })
      )
      .mockResolvedValueOnce(
        createProvider({
          id: 'provider_oidc',
          slug: 'enterprise-oidc',
          scimBearerTokenRef: 'SCIM_BEARER_TOKEN'
        })
      );

    await expect(
      service.handleSamlCallback('enterprise-saml', undefined, undefined, {})
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(service.assertValidScimBearerToken('Bearer wrong-token')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    await expect(service.assertValidScimBearerToken('Bearer scim-secret')).resolves.toBeUndefined();
  });
});
