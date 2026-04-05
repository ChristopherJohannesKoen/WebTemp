import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type IdentityProviderType, type Role, type User } from '@prisma/client';
import {
  type IdentityProviderSummary,
  IdentityProviderSummarySchema,
  ScimGroupSchema,
  type ScimUser,
  ScimUserListResponseSchema,
  ScimUserSchema,
  type SessionUser,
  type SsoProvidersResponse
} from '@packages/shared';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DOMParser } from '@xmldom/xmldom';
import { XMLParser } from 'fast-xml-parser';
import { SignedXml } from 'xml-crypto';
import { readBooleanConfig } from '../../common/config/boolean-config';
import { normalizeAppEnvironment } from '../../common/config/app-environment';
import { publicUserSelect } from '../../common/prisma/public-selects';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { SecretService } from '../../common/secrets/secret.service';
import { AuditService } from '../audit/audit.service';
import { normalizeDisplayName, normalizeEmail } from '../auth/auth.helpers';
import { SessionService } from '../auth/session.service';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type EnterpriseLoginResult = {
  user: SessionUser;
  token: string;
  expiresAt: Date;
  redirectTo: string;
};

type StatePayload = {
  slug: string;
  redirectTo: string;
  issuedAt: number;
  nonce?: string;
  verifier?: string;
};

type ProviderRecord = {
  id: string;
  slug: string;
  displayName: string;
  type: IdentityProviderType;
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
};

type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type ParsedSamlAssertion = {
  subject: string;
  email: string;
  name: string;
  groups: string[];
};

function parseList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeRedirectTarget(redirectTo: string | undefined) {
  return redirectTo && redirectTo.startsWith('/') ? redirectTo : '/app';
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function createPkceChallenge(verifier: string) {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function extractScimEmail(payload: ScimUser) {
  const primaryEmail = payload.emails.find((email) => email.primary)?.value;
  return normalizeEmail(primaryEmail ?? payload.emails[0]?.value ?? payload.userName);
}

function splitDisplayName(displayName: string | undefined) {
  const value = normalizeDisplayName(displayName ?? 'Enterprise User');
  const [givenName, ...rest] = value.split(/\s+/);

  return {
    givenName,
    familyName: rest.join(' ') || undefined,
    formatted: value
  };
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate['#text'] === 'string') {
      return candidate['#text'];
    }

    if (typeof candidate._text === 'string') {
      return candidate._text;
    }
  }

  return undefined;
}

function isSerializableConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

@Injectable()
export class IdentityService implements OnModuleInit {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    attributeNamePrefix: ''
  });

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly secretService: SecretService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
    private readonly requestContextService: RequestContextService
  ) {}

  async onModuleInit() {
    if (!this.isEnterpriseIdentityEnabled()) {
      return;
    }

    await this.syncConfiguredProviders();
  }

  async listProviders(): Promise<SsoProvidersResponse> {
    const providers = await this.prismaService.identityProviderConfig.findMany({
      where: {
        status: 'active'
      },
      orderBy: [{ type: 'asc' }, { displayName: 'asc' }]
    });

    return {
      providers: providers.map((provider) => this.toProviderSummary(provider as ProviderRecord)),
      localAuthEnabled: !this.isEnterpriseIdentityEnforced(),
      breakGlassEnabled: this.isBreakGlassEnabled()
    };
  }

  async startLogin(providerSlug: string, redirectTo?: string) {
    const provider = await this.getProvider(providerSlug);
    const targetPath = normalizeRedirectTarget(redirectTo);

    if (provider.type === 'oidc') {
      return this.startOidcLogin(provider, targetPath);
    }

    return this.startSamlLogin(provider, targetPath);
  }

  async handleOidcCallback(
    providerSlug: string,
    params: Record<string, string | string[] | undefined>,
    metadata: SessionMetadata
  ): Promise<EnterpriseLoginResult> {
    const provider = await this.getProvider(providerSlug, 'oidc');
    const stateValue = Array.isArray(params.state) ? params.state[0] : params.state;
    const authorizationCode = Array.isArray(params.code) ? params.code[0] : params.code;
    const providerError = Array.isArray(params.error) ? params.error[0] : params.error;
    const providerErrorDescription = Array.isArray(params.error_description)
      ? params.error_description[0]
      : params.error_description;

    if (providerError) {
      this.metricsService.recordIdentityEvent('oidc_callback_failure');
      throw new UnauthorizedException(
        providerErrorDescription || 'Enterprise sign-in was rejected by the identity provider.'
      );
    }

    if (!stateValue || !authorizationCode) {
      throw new UnauthorizedException('The OIDC callback did not include a valid state and code.');
    }

    const state = this.decryptState(stateValue);

    if (state.slug !== provider.slug || !state.verifier) {
      throw new UnauthorizedException('The OIDC callback state is invalid.');
    }

    const discovery = await this.resolveOidcDiscovery(provider);
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: this.getProviderCallbackUrl(provider.slug),
        client_id: provider.clientId ?? '',
        client_secret: this.getProviderClientSecret(provider),
        code_verifier: state.verifier
      }).toString()
    });

    if (!tokenResponse.ok) {
      this.metricsService.recordIdentityEvent('oidc_callback_failure');
      throw new UnauthorizedException('The OIDC token exchange failed.');
    }

    const tokenPayload = (await tokenResponse.json()) as {
      id_token?: string;
    };

    if (!tokenPayload.id_token) {
      throw new UnauthorizedException('The OIDC token response did not include an id_token.');
    }

    const keySet = createRemoteJWKSet(new URL(discovery.jwks_uri));
    const { payload } = await jwtVerify(tokenPayload.id_token, keySet, {
      issuer: provider.issuer ?? discovery.issuer,
      audience: provider.clientId ?? undefined
    });

    if (state.nonce && payload.nonce !== state.nonce) {
      throw new UnauthorizedException('The OIDC nonce validation failed.');
    }

    const emailClaim = provider.emailClaim ?? 'email';
    const subjectClaim = provider.subjectClaim ?? 'sub';
    const groupClaim = provider.groupClaim ?? 'groups';
    const email = normalizeEmail(
      String(payload[emailClaim] ?? payload.email ?? payload.preferred_username ?? '')
    );
    const externalSubject = String(payload[subjectClaim] ?? payload.sub ?? '');
    const name = normalizeDisplayName(
      String(payload.name ?? payload.preferred_username ?? payload[emailClaim] ?? 'Enterprise User')
    );
    const groups = ensureArray(payload[groupClaim] as string | string[] | undefined).map(String);

    if (!email || !externalSubject) {
      throw new UnauthorizedException(
        'The OIDC profile did not include the required identity claims.'
      );
    }

    this.assertVerifiedDomain(provider, email);

    const user = await this.upsertEnterpriseUser({
      provider,
      email,
      name,
      externalSubject,
      groups,
      active: true,
      source: 'jit_provision'
    });

    const { token, expiresAt } = await this.sessionService.createSession(user.id, {
      ...metadata,
      authMethod: 'oidc',
      authReason: 'oidc_login',
      identityProviderId: provider.id,
      identityProvider: this.toProviderSummary(provider),
      externalSubject
    });

    await this.prismaService.userIdentity.updateMany({
      where: {
        providerId: provider.id,
        externalSubject,
        userId: user.id
      },
      data: {
        lastAuthenticatedAt: new Date()
      }
    });

    this.metricsService.recordIdentityEvent('oidc_login_success');
    await this.auditService.log({
      actorId: user.id,
      action: 'auth.sso_login',
      targetType: 'user',
      targetId: user.id,
      eventCategory: 'authentication',
      outcome: 'success',
      authMechanism: 'oidc',
      metadata: {
        provider: provider.slug,
        subject: externalSubject
      }
    });

    return {
      user: this.toSessionUser(user, provider),
      token,
      expiresAt,
      redirectTo: state.redirectTo
    };
  }

  async handleSamlCallback(
    providerSlug: string,
    samlResponse: string | undefined,
    relayState: string | undefined,
    metadata: SessionMetadata
  ): Promise<EnterpriseLoginResult> {
    const provider = await this.getProvider(providerSlug, 'saml');

    if (!samlResponse || !relayState) {
      throw new UnauthorizedException('The SAML callback did not include a valid response.');
    }

    const state = this.decryptState(relayState);

    if (state.slug !== provider.slug) {
      throw new UnauthorizedException('The SAML relay state is invalid.');
    }

    const xml = Buffer.from(samlResponse, 'base64').toString('utf8');
    this.assertValidSamlSignature(xml, provider);
    const assertion = this.parseSamlAssertion(provider, xml);
    this.assertVerifiedDomain(provider, assertion.email);

    const user = await this.upsertEnterpriseUser({
      provider,
      email: assertion.email,
      name: assertion.name,
      externalSubject: assertion.subject,
      groups: assertion.groups,
      active: true,
      source: 'jit_provision'
    });

    const { token, expiresAt } = await this.sessionService.createSession(user.id, {
      ...metadata,
      authMethod: 'saml',
      authReason: 'saml_login',
      identityProviderId: provider.id,
      identityProvider: this.toProviderSummary(provider),
      externalSubject: assertion.subject
    });

    await this.prismaService.userIdentity.updateMany({
      where: {
        providerId: provider.id,
        externalSubject: assertion.subject,
        userId: user.id
      },
      data: {
        lastAuthenticatedAt: new Date()
      }
    });

    this.metricsService.recordIdentityEvent('saml_login_success');
    await this.auditService.log({
      actorId: user.id,
      action: 'auth.sso_login',
      targetType: 'user',
      targetId: user.id,
      eventCategory: 'authentication',
      outcome: 'success',
      authMechanism: 'saml',
      metadata: {
        provider: provider.slug,
        subject: assertion.subject
      }
    });

    return {
      user: this.toSessionUser(user, provider),
      token,
      expiresAt,
      redirectTo: state.redirectTo
    };
  }

  async listScimUsers() {
    const provider = await this.getScimProvider();
    const identities = await this.prismaService.userIdentity.findMany({
      where: {
        providerId: provider.id
      },
      include: {
        user: {
          select: {
            ...publicUserSelect,
            disabledReason: true
          }
        }
      }
    });

    const resources = await Promise.all(
      identities.map((identity) =>
        this.toScimUser(identity.user, provider, identity.externalSubject)
      )
    );

    return ScimUserListResponseSchema.parse({
      totalResults: resources.length,
      startIndex: 1,
      itemsPerPage: resources.length,
      Resources: resources
    });
  }

  async listScimGroups() {
    const provider = await this.getScimProvider();
    const groups = await this.prismaService.userGroup.findMany({
      where: {
        providerId: provider.id
      },
      include: {
        memberships: {
          include: {
            user: {
              select: publicUserSelect
            }
          }
        }
      }
    });

    const resources = groups.map((group) =>
      ScimGroupSchema.parse({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: group.externalId,
        externalId: group.externalId,
        displayName: group.name,
        members: group.memberships.map((membership) => ({
          value: membership.user.email,
          display: membership.user.name
        }))
      })
    );

    return {
      totalResults: resources.length,
      startIndex: 1,
      itemsPerPage: resources.length,
      Resources: resources
    };
  }

  async upsertScimUser(payload: unknown) {
    const provider = await this.getScimProvider();
    const userPayload = ScimUserSchema.parse(payload);
    const email = extractScimEmail(userPayload);
    const nameParts = splitDisplayName(userPayload.displayName);
    const externalSubject = userPayload.externalId ?? userPayload.id ?? email;
    const user = await this.upsertEnterpriseUser({
      provider,
      email,
      name:
        userPayload.displayName ??
        [userPayload.name?.givenName, userPayload.name?.familyName].filter(Boolean).join(' ') ??
        nameParts.formatted,
      externalSubject,
      groups: userPayload.groups.map((group) => group.value),
      active: userPayload.active,
      source: 'scim_provision'
    });

    await this.prismaService.provisioningCursor.upsert({
      where: {
        providerId_cursorType: {
          providerId: provider.id,
          cursorType: 'scim_users'
        }
      },
      create: {
        providerId: provider.id,
        cursorType: 'scim_users',
        cursorValue: externalSubject,
        lastSyncedAt: new Date()
      },
      update: {
        cursorValue: externalSubject,
        lastSyncedAt: new Date()
      }
    });

    this.metricsService.recordIdentityEvent(
      userPayload.active ? 'scim_user_upserted' : 'scim_user_disabled'
    );
    await this.auditService.log({
      actorId: this.requestContextService.get()?.actorId ?? null,
      action: 'identity.scim_user_provisioned',
      targetType: 'user',
      targetId: user.id,
      eventCategory: 'provisioning',
      outcome: 'success',
      metadata: {
        provider: provider.slug,
        externalSubject,
        active: userPayload.active
      }
    });

    return this.toScimUser(user, provider, externalSubject);
  }

  async disableScimUser(externalId: string) {
    const provider = await this.getScimProvider();
    const identity = await this.prismaService.userIdentity.findFirst({
      where: {
        providerId: provider.id,
        externalSubject: externalId
      },
      include: {
        user: true
      }
    });

    if (!identity) {
      throw new NotFoundException('SCIM user not found.');
    }

    const disabledUser = await this.prismaService.user.update({
      where: { id: identity.userId },
      data: {
        disabledAt: new Date(),
        disabledReason: 'scim_deactivated'
      },
      select: publicUserSelect
    });

    await this.prismaService.accessPolicyEvent.create({
      data: {
        providerId: provider.id,
        targetUserId: identity.userId,
        event: 'scim_provision',
        outcome: 'success',
        reason: 'scim_deactivated'
      }
    });

    this.metricsService.recordIdentityEvent('scim_user_disabled');
    return this.toScimUser(disabledUser, provider, externalId);
  }

  async upsertScimGroup(payload: unknown) {
    const provider = await this.getScimProvider();
    const groupPayload = ScimGroupSchema.parse(payload);
    const group = await this.prismaService.userGroup.upsert({
      where: {
        providerId_externalId: {
          providerId: provider.id,
          externalId: groupPayload.externalId
        }
      },
      create: {
        providerId: provider.id,
        externalId: groupPayload.externalId,
        name: groupPayload.displayName
      },
      update: {
        name: groupPayload.displayName
      }
    });

    const identities = await this.prismaService.userIdentity.findMany({
      where: {
        providerId: provider.id,
        externalSubject: {
          in: groupPayload.members.map((member) => member.value)
        }
      },
      select: {
        userId: true
      }
    });

    const userIds = identities.map((identity) => identity.userId);
    await this.prismaService.userGroupMembership.deleteMany({
      where: {
        userGroupId: group.id,
        userId: {
          notIn: userIds.length > 0 ? userIds : ['__none__']
        }
      }
    });

    if (userIds.length > 0) {
      await this.prismaService.userGroupMembership.createMany({
        data: userIds.map((userId) => ({
          userId,
          userGroupId: group.id
        })),
        skipDuplicates: true
      });
    }

    await this.prismaService.provisioningCursor.upsert({
      where: {
        providerId_cursorType: {
          providerId: provider.id,
          cursorType: 'scim_groups'
        }
      },
      create: {
        providerId: provider.id,
        cursorType: 'scim_groups',
        cursorValue: group.externalId,
        lastSyncedAt: new Date()
      },
      update: {
        cursorValue: group.externalId,
        lastSyncedAt: new Date()
      }
    });

    this.metricsService.recordIdentityEvent('scim_group_upserted');
    await this.auditService.log({
      action: 'identity.scim_group_provisioned',
      targetType: 'group',
      targetId: group.id,
      eventCategory: 'provisioning',
      outcome: 'success',
      metadata: {
        provider: provider.slug,
        externalId: group.externalId
      }
    });

    return ScimGroupSchema.parse({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: group.externalId,
      externalId: group.externalId,
      displayName: group.name,
      members: groupPayload.members
    });
  }

  async assertValidScimBearerToken(authorizationHeader: string | undefined) {
    const provider = await this.getScimProvider();
    const [scheme, token] = (authorizationHeader ?? '').split(' ');
    const expectedToken = provider.scimBearerTokenRef
      ? this.secretService.getRequiredSecret(provider.scimBearerTokenRef)
      : undefined;

    if (scheme !== 'Bearer' || !token || !expectedToken || !this.safeEquals(token, expectedToken)) {
      throw new UnauthorizedException('A valid SCIM bearer token is required.');
    }
  }

  private async syncConfiguredProviders() {
    const providers = [this.getConfiguredOidcProvider(), this.getConfiguredSamlProvider()].filter(
      Boolean
    ) as Array<ProviderRecord & { groupMappings: Array<{ externalId: string; role: Role }> }>;

    for (const provider of providers) {
      const upsertedProvider = await this.prismaService.identityProviderConfig.upsert({
        where: { slug: provider.slug },
        create: {
          slug: provider.slug,
          displayName: provider.displayName,
          type: provider.type,
          status: provider.status,
          issuer: provider.issuer,
          authorizationEndpoint: provider.authorizationEndpoint,
          tokenEndpoint: provider.tokenEndpoint,
          jwksUri: provider.jwksUri,
          clientId: provider.clientId,
          clientSecretRef: provider.clientSecretRef,
          scopes: provider.scopes,
          samlSsoUrl: provider.samlSsoUrl,
          samlEntityId: provider.samlEntityId,
          samlCertificatePem: provider.samlCertificatePem,
          verifiedDomains: provider.verifiedDomains,
          groupClaim: provider.groupClaim,
          emailClaim: provider.emailClaim,
          subjectClaim: provider.subjectClaim,
          scimBearerTokenRef: provider.scimBearerTokenRef
        },
        update: {
          displayName: provider.displayName,
          type: provider.type,
          status: provider.status,
          issuer: provider.issuer,
          authorizationEndpoint: provider.authorizationEndpoint,
          tokenEndpoint: provider.tokenEndpoint,
          jwksUri: provider.jwksUri,
          clientId: provider.clientId,
          clientSecretRef: provider.clientSecretRef,
          scopes: provider.scopes,
          samlSsoUrl: provider.samlSsoUrl,
          samlEntityId: provider.samlEntityId,
          samlCertificatePem: provider.samlCertificatePem,
          verifiedDomains: provider.verifiedDomains,
          groupClaim: provider.groupClaim,
          emailClaim: provider.emailClaim,
          subjectClaim: provider.subjectClaim,
          scimBearerTokenRef: provider.scimBearerTokenRef
        }
      });

      for (const mapping of provider.groupMappings) {
        const group = await this.prismaService.userGroup.upsert({
          where: {
            providerId_externalId: {
              providerId: upsertedProvider.id,
              externalId: mapping.externalId
            }
          },
          create: {
            providerId: upsertedProvider.id,
            externalId: mapping.externalId,
            name: mapping.externalId
          },
          update: {
            name: mapping.externalId
          }
        });

        await this.prismaService.groupRoleMapping.upsert({
          where: { userGroupId: group.id },
          create: {
            userGroupId: group.id,
            role: mapping.role
          },
          update: {
            role: mapping.role
          }
        });
      }

      await this.prismaService.accessPolicyEvent.create({
        data: {
          providerId: upsertedProvider.id,
          event: 'provider_configuration_changed',
          outcome: 'success',
          reason: 'startup_sync',
          metadata: {
            type: upsertedProvider.type,
            verifiedDomains: upsertedProvider.verifiedDomains
          }
        }
      });

      await this.auditService.log({
        action: 'identity.provider_upserted',
        targetType: 'identity_provider',
        targetId: upsertedProvider.id,
        eventCategory: 'configuration',
        outcome: 'success',
        metadata: {
          slug: upsertedProvider.slug,
          type: upsertedProvider.type
        }
      });
    }
  }

  private getConfiguredOidcProvider() {
    const slug = this.configService.get<string>('OIDC_PROVIDER_SLUG')?.trim();

    if (!slug) {
      return undefined;
    }

    return {
      id: '',
      slug,
      displayName: this.configService.get<string>('OIDC_PROVIDER_DISPLAY_NAME', 'Enterprise SSO'),
      type: 'oidc' as const,
      status: 'active' as const,
      issuer: this.configService.get<string>('OIDC_ISSUER') ?? null,
      authorizationEndpoint: this.configService.get<string>('OIDC_AUTHORIZATION_ENDPOINT') ?? null,
      tokenEndpoint: this.configService.get<string>('OIDC_TOKEN_ENDPOINT') ?? null,
      jwksUri: this.configService.get<string>('OIDC_JWKS_URI') ?? null,
      clientId: this.configService.get<string>('OIDC_CLIENT_ID') ?? null,
      clientSecretRef: 'OIDC_CLIENT_SECRET',
      scopes:
        parseList(this.configService.get<string>('OIDC_SCOPES')).length > 0
          ? parseList(this.configService.get<string>('OIDC_SCOPES'))
          : ['openid', 'profile', 'email'],
      samlSsoUrl: null,
      samlEntityId: null,
      samlCertificatePem: null,
      verifiedDomains: parseList(this.configService.get<string>('OIDC_VERIFIED_DOMAINS')),
      groupClaim: this.configService.get<string>('OIDC_GROUP_CLAIM') ?? 'groups',
      emailClaim: this.configService.get<string>('OIDC_EMAIL_CLAIM') ?? 'email',
      subjectClaim: this.configService.get<string>('OIDC_SUBJECT_CLAIM') ?? 'sub',
      scimBearerTokenRef: this.secretService.getOptionalSecret('SCIM_BEARER_TOKEN')
        ? 'SCIM_BEARER_TOKEN'
        : null,
      groupMappings: this.parseGroupRoleMappings(
        this.configService.get<string>('OIDC_GROUP_ROLE_MAPPINGS')
      )
    };
  }

  private getConfiguredSamlProvider() {
    const slug = this.configService.get<string>('SAML_PROVIDER_SLUG')?.trim();

    if (!slug) {
      return undefined;
    }

    return {
      id: '',
      slug,
      displayName: this.configService.get<string>('SAML_PROVIDER_DISPLAY_NAME', 'Enterprise SAML'),
      type: 'saml' as const,
      status: 'active' as const,
      issuer: null,
      authorizationEndpoint: null,
      tokenEndpoint: null,
      jwksUri: null,
      clientId: null,
      clientSecretRef: null,
      scopes: [],
      samlSsoUrl: this.configService.get<string>('SAML_SSO_URL') ?? null,
      samlEntityId: this.configService.get<string>('SAML_ENTITY_ID') ?? null,
      samlCertificatePem:
        this.secretService.getOptionalSecret('SAML_CERTIFICATE_PEM') ??
        this.configService.get<string>('SAML_CERTIFICATE_PEM') ??
        null,
      verifiedDomains: parseList(this.configService.get<string>('SAML_VERIFIED_DOMAINS')),
      groupClaim: this.configService.get<string>('SAML_GROUP_ATTRIBUTE') ?? 'groups',
      emailClaim: this.configService.get<string>('SAML_EMAIL_ATTRIBUTE') ?? 'email',
      subjectClaim: this.configService.get<string>('SAML_SUBJECT_ATTRIBUTE') ?? 'NameID',
      scimBearerTokenRef: this.secretService.getOptionalSecret('SCIM_BEARER_TOKEN')
        ? 'SCIM_BEARER_TOKEN'
        : null,
      groupMappings: this.parseGroupRoleMappings(
        this.configService.get<string>('SAML_GROUP_ROLE_MAPPINGS')
      )
    };
  }

  private async getProvider(slug: string, expectedType?: IdentityProviderType) {
    const provider = await this.prismaService.identityProviderConfig.findUnique({
      where: { slug }
    });

    if (!provider || provider.status !== 'active') {
      throw new NotFoundException('Identity provider not found.');
    }

    if (expectedType && provider.type !== expectedType) {
      throw new ForbiddenException('The selected identity provider does not support this flow.');
    }

    return provider as ProviderRecord;
  }

  private async getScimProvider() {
    const defaultSlug = this.configService.get<string>('ENTERPRISE_DEFAULT_PROVIDER_SLUG');
    const provider =
      (defaultSlug
        ? await this.prismaService.identityProviderConfig.findUnique({
            where: { slug: defaultSlug }
          })
        : null) ??
      (await this.prismaService.identityProviderConfig.findFirst({
        where: {
          status: 'active',
          scimBearerTokenRef: {
            not: null
          }
        },
        orderBy: { updatedAt: 'desc' }
      }));

    if (!provider || !provider.scimBearerTokenRef) {
      throw new ForbiddenException('SCIM is not configured for this environment.');
    }

    return provider as ProviderRecord;
  }

  private async startOidcLogin(provider: ProviderRecord, redirectTo: string) {
    const discovery = await this.resolveOidcDiscovery(provider);
    const verifier = base64Url(randomBytes(32));
    const nonce = base64Url(randomBytes(16));
    const state = this.encryptState({
      slug: provider.slug,
      redirectTo,
      issuedAt: Date.now(),
      verifier,
      nonce
    });
    const redirectUrl = new URL(discovery.authorization_endpoint);
    redirectUrl.searchParams.set('client_id', provider.clientId ?? '');
    redirectUrl.searchParams.set('response_type', 'code');
    redirectUrl.searchParams.set('redirect_uri', this.getProviderCallbackUrl(provider.slug));
    redirectUrl.searchParams.set(
      'scope',
      provider.scopes.length > 0 ? provider.scopes.join(' ') : 'openid profile email'
    );
    redirectUrl.searchParams.set('state', state);
    redirectUrl.searchParams.set('nonce', nonce);
    redirectUrl.searchParams.set('code_challenge', createPkceChallenge(verifier));
    redirectUrl.searchParams.set('code_challenge_method', 'S256');

    this.metricsService.recordIdentityEvent('oidc_login_started');
    await this.auditService.log({
      action: 'auth.sso_provider_started',
      targetType: 'identity_provider',
      targetId: provider.id,
      eventCategory: 'authentication',
      outcome: 'success',
      metadata: {
        provider: provider.slug,
        redirectTo
      }
    });

    return {
      redirectUrl: redirectUrl.toString()
    };
  }

  private async startSamlLogin(provider: ProviderRecord, redirectTo: string) {
    const requestId = `_${randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const callbackUrl = this.getProviderCallbackUrl(provider.slug);
    const issuer = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" AssertionConsumerServiceURL="${callbackUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
      `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>`,
      '</samlp:AuthnRequest>'
    ].join('');
    const samlRequest = deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
    const relayState = this.encryptState({
      slug: provider.slug,
      redirectTo,
      issuedAt: Date.now()
    });
    const redirectUrl = new URL(provider.samlSsoUrl ?? '');
    redirectUrl.searchParams.set('SAMLRequest', samlRequest);
    redirectUrl.searchParams.set('RelayState', relayState);

    this.metricsService.recordIdentityEvent('saml_login_started');
    await this.auditService.log({
      action: 'auth.sso_provider_started',
      targetType: 'identity_provider',
      targetId: provider.id,
      eventCategory: 'authentication',
      outcome: 'success',
      metadata: {
        provider: provider.slug,
        redirectTo
      }
    });

    return {
      redirectUrl: redirectUrl.toString()
    };
  }

  private async resolveOidcDiscovery(provider: ProviderRecord): Promise<OidcDiscoveryDocument> {
    if (
      provider.authorizationEndpoint &&
      provider.tokenEndpoint &&
      provider.jwksUri &&
      provider.issuer
    ) {
      return {
        issuer: provider.issuer,
        authorization_endpoint: provider.authorizationEndpoint,
        token_endpoint: provider.tokenEndpoint,
        jwks_uri: provider.jwksUri
      };
    }

    if (!provider.issuer) {
      throw new ForbiddenException('The OIDC provider is missing issuer metadata.');
    }

    const discoveryUrl = `${provider.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      throw new UnauthorizedException('Could not load the OIDC discovery document.');
    }

    return (await response.json()) as OidcDiscoveryDocument;
  }

  private async upsertEnterpriseUser(input: {
    provider: ProviderRecord;
    email: string;
    name: string;
    externalSubject: string;
    groups: string[];
    active: boolean;
    source: 'jit_provision' | 'scim_provision';
  }) {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedName = normalizeDisplayName(input.name);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.prismaService.$transaction(
          async (transaction) => {
            const existingIdentity = await transaction.userIdentity.findUnique({
              where: {
                providerId_externalSubject: {
                  providerId: input.provider.id,
                  externalSubject: input.externalSubject
                }
              },
              include: {
                user: true
              }
            });

            const linkedUser =
              existingIdentity?.user ??
              (await transaction.user.findUnique({
                where: { email: normalizedEmail }
              }));

            const mappedRole = await this.resolveMappedRole(
              transaction,
              input.provider.id,
              input.groups,
              linkedUser?.role ?? null
            );

            const user = linkedUser
              ? await transaction.user.update({
                  where: { id: linkedUser.id },
                  data: {
                    email: normalizedEmail,
                    name: normalizedName,
                    role: linkedUser.role === 'owner' ? 'owner' : mappedRole,
                    disabledAt: input.active ? null : new Date(),
                    disabledReason: input.active ? null : 'scim_deactivated',
                    provisionedBy: input.provider.type
                  },
                  select: publicUserSelect
                })
              : await transaction.user.create({
                  data: {
                    email: normalizedEmail,
                    name: normalizedName,
                    role: mappedRole,
                    provisionedBy: input.provider.type,
                    disabledAt: input.active ? null : new Date(),
                    disabledReason: input.active ? null : 'scim_deactivated'
                  },
                  select: publicUserSelect
                });

            await transaction.userIdentity.upsert({
              where: {
                providerId_externalSubject: {
                  providerId: input.provider.id,
                  externalSubject: input.externalSubject
                }
              },
              create: {
                providerId: input.provider.id,
                userId: user.id,
                externalSubject: input.externalSubject,
                email: normalizedEmail,
                displayName: normalizedName,
                lastAuthenticatedAt: input.source === 'jit_provision' ? new Date() : null
              },
              update: {
                userId: user.id,
                email: normalizedEmail,
                displayName: normalizedName,
                lastAuthenticatedAt: input.source === 'jit_provision' ? new Date() : undefined
              }
            });

            await this.syncEnterpriseMemberships(
              transaction,
              user.id,
              input.provider.id,
              input.groups
            );

            await transaction.accessPolicyEvent.create({
              data: {
                providerId: input.provider.id,
                targetUserId: user.id,
                event: input.source,
                outcome: 'success',
                reason: input.groups.length > 0 ? 'group_mapped' : 'default_member',
                metadata: {
                  groups: input.groups,
                  role: user.role,
                  active: input.active
                }
              }
            });

            return user;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );

        if (input.groups.length > 0) {
          await this.auditService.log({
            actorId: result.id,
            action: 'identity.group_mapping_applied',
            targetType: 'user',
            targetId: result.id,
            eventCategory: 'authorization',
            outcome: 'success',
            metadata: {
              provider: input.provider.slug,
              groups: input.groups,
              role: result.role
            }
          });
        }

        return result;
      } catch (error) {
        if (isSerializableConflict(error) && attempt < maxAttempts) {
          continue;
        }

        throw error;
      }
    }

    throw new ForbiddenException('Could not complete enterprise identity provisioning.');
  }

  private async resolveMappedRole(
    transaction: Prisma.TransactionClient,
    providerId: string,
    groups: string[],
    currentRole: Role | null
  ): Promise<Role> {
    if (currentRole === 'owner') {
      return 'owner';
    }

    if (groups.length === 0) {
      return currentRole === 'admin' ? 'admin' : 'member';
    }

    const mappings = await transaction.groupRoleMapping.findMany({
      where: {
        userGroup: {
          providerId,
          externalId: {
            in: groups
          }
        }
      }
    });

    if (mappings.some((mapping) => mapping.role === 'admin')) {
      return 'admin';
    }

    if (mappings.some((mapping) => mapping.role === 'member')) {
      return 'member';
    }

    return currentRole === 'admin' ? 'admin' : 'member';
  }

  private async syncEnterpriseMemberships(
    transaction: Prisma.TransactionClient,
    userId: string,
    providerId: string,
    groups: string[]
  ) {
    const existingGroups = await transaction.userGroup.findMany({
      where: {
        providerId
      },
      select: {
        id: true,
        externalId: true
      }
    });

    const existingGroupMap = new Map(existingGroups.map((group) => [group.externalId, group]));
    const groupIds: string[] = [];

    for (const externalId of groups) {
      const existingGroup = existingGroupMap.get(externalId);

      if (existingGroup) {
        groupIds.push(existingGroup.id);
        continue;
      }

      const createdGroup = await transaction.userGroup.create({
        data: {
          providerId,
          externalId,
          name: externalId
        },
        select: {
          id: true,
          externalId: true
        }
      });
      groupIds.push(createdGroup.id);
      existingGroupMap.set(createdGroup.externalId, createdGroup);
    }

    await transaction.userGroupMembership.deleteMany({
      where: {
        userId,
        userGroup: {
          providerId,
          id: {
            notIn: groupIds.length > 0 ? groupIds : ['__none__']
          }
        }
      }
    });

    if (groupIds.length > 0) {
      await transaction.userGroupMembership.createMany({
        data: groupIds.map((userGroupId) => ({
          userId,
          userGroupId
        })),
        skipDuplicates: true
      });
    }
  }

  private async toScimUser(
    user: {
      id: string;
      email: string;
      name: string;
      disabledAt: Date | null;
    },
    provider: ProviderRecord,
    externalSubject: string
  ) {
    const memberships = await this.prismaService.userGroupMembership.findMany({
      where: {
        userId: user.id,
        userGroup: {
          providerId: provider.id
        }
      },
      include: {
        userGroup: true
      }
    });
    const name = splitDisplayName(user.name);

    return ScimUserSchema.parse({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: externalSubject,
      externalId: externalSubject,
      userName: user.email,
      active: !user.disabledAt,
      displayName: user.name,
      name: {
        givenName: name.givenName,
        familyName: name.familyName
      },
      emails: [{ value: user.email, primary: true }],
      groups: memberships.map((membership) => ({
        value: membership.userGroup.externalId,
        display: membership.userGroup.name
      }))
    });
  }

  private parseGroupRoleMappings(value: string | undefined) {
    return parseList(value)
      .map((entry) => {
        const [externalId, role] = entry.split(':', 2).map((segment) => segment.trim());
        if (!externalId || (role !== 'admin' && role !== 'member')) {
          return undefined;
        }

        return {
          externalId,
          role
        };
      })
      .filter(Boolean) as Array<{ externalId: string; role: Role }>;
  }

  private assertVerifiedDomain(provider: ProviderRecord, email: string) {
    if (provider.verifiedDomains.length === 0) {
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain || !provider.verifiedDomains.includes(domain)) {
      this.metricsService.recordIdentityEvent('sso_domain_denied');
      throw new ForbiddenException('The enterprise identity provider denied this email domain.');
    }
  }

  private getProviderClientSecret(provider: ProviderRecord) {
    if (!provider.clientSecretRef) {
      throw new ForbiddenException('The OIDC provider is missing a client secret reference.');
    }

    return this.secretService.getRequiredSecret(provider.clientSecretRef);
  }

  private getProviderCallbackUrl(providerSlug: string) {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    return new URL(`/api/auth/sso/${providerSlug}/callback`, appUrl).toString();
  }

  private encryptState(payload: StatePayload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getStateEncryptionKey(), iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, encrypted, authTag].map((part) => part.toString('base64url')).join('.');
  }

  private decryptState(value: string): StatePayload {
    const [ivValue, encryptedValue, authTagValue] = value.split('.');

    if (!ivValue || !encryptedValue || !authTagValue) {
      throw new UnauthorizedException('The enterprise sign-in state is invalid.');
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getStateEncryptionKey(),
        Buffer.from(ivValue, 'base64url')
      );
      decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final()
      ]).toString('utf8');
      const payload = JSON.parse(plaintext) as StatePayload;

      if (Date.now() - payload.issuedAt > 1000 * 60 * 10) {
        throw new UnauthorizedException('The enterprise sign-in state has expired.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('The enterprise sign-in state could not be decrypted.');
    }
  }

  private getStateEncryptionKey() {
    const secretValue =
      this.secretService.getOptionalSecret('SSO_STATE_ENCRYPTION_KEY') ??
      this.secretService.getRequiredSecret('SESSION_COOKIE_ENCRYPTION_KEY');
    const encryptionKey = Buffer.from(secretValue, 'hex');

    if (encryptionKey.length !== 32) {
      throw new Error('The SSO state encryption key must be a 64-character hex string.');
    }

    return encryptionKey;
  }

  private assertValidSamlSignature(xml: string, provider: ProviderRecord) {
    if (!provider.samlCertificatePem) {
      throw new UnauthorizedException('The SAML provider is missing a signing certificate.');
    }

    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const signatureNode = document.getElementsByTagName('Signature')[0];

    if (!signatureNode) {
      throw new UnauthorizedException('The SAML response signature is missing.');
    }

    const signature = new SignedXml() as SignedXml & { publicCert?: string };
    signature.publicCert = provider.samlCertificatePem;
    signature.loadSignature(signatureNode as unknown as Node);

    if (!signature.checkSignature(xml)) {
      throw new UnauthorizedException('The SAML response signature is invalid.');
    }
  }

  private parseSamlAssertion(provider: ProviderRecord, xml: string): ParsedSamlAssertion {
    const parsed = this.xmlParser.parse(xml) as Record<string, unknown>;
    const response = parsed.Response as Record<string, unknown> | undefined;
    const assertion = response?.Assertion as Record<string, unknown> | undefined;

    if (!response || !assertion) {
      throw new UnauthorizedException('The SAML response did not include a valid assertion.');
    }

    const issuer = textValue(assertion.Issuer) ?? textValue(response.Issuer);

    if (provider.samlEntityId && issuer !== provider.samlEntityId) {
      throw new UnauthorizedException('The SAML response issuer is not trusted.');
    }

    const conditions = assertion.Conditions as Record<string, unknown> | undefined;
    const notBefore = conditions?.NotBefore ? new Date(String(conditions.NotBefore)) : undefined;
    const notOnOrAfter = conditions?.NotOnOrAfter
      ? new Date(String(conditions.NotOnOrAfter))
      : undefined;
    const now = new Date();
    const skewMs = 1000 * 60 * 3;

    if (notBefore && now.getTime() + skewMs < notBefore.getTime()) {
      throw new UnauthorizedException('The SAML assertion is not valid yet.');
    }

    if (notOnOrAfter && now.getTime() - skewMs >= notOnOrAfter.getTime()) {
      throw new UnauthorizedException('The SAML assertion has expired.');
    }

    const audienceRestrictions = ensureArray(
      conditions?.AudienceRestriction as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined
    );
    const audiences = audienceRestrictions.flatMap((restriction) =>
      ensureArray(restriction.Audience).map((audience) => textValue(audience) ?? String(audience))
    );
    const callbackUrl = this.getProviderCallbackUrl(provider.slug);
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    if (audiences.length > 0 && !audiences.includes(callbackUrl) && !audiences.includes(appUrl)) {
      throw new UnauthorizedException('The SAML assertion audience is invalid.');
    }

    const subjectRecord = assertion.Subject as Record<string, unknown> | undefined;
    const nameIdValue =
      textValue(subjectRecord?.NameID) ??
      textValue(subjectRecord?.[provider.subjectClaim ?? 'NameID']);
    const attributeStatement = ensureArray(assertion.AttributeStatement)[0] as
      | Record<string, unknown>
      | undefined;
    const attributeMap = new Map<string, string[]>();

    for (const attribute of ensureArray(attributeStatement?.Attribute) as Array<
      Record<string, unknown>
    >) {
      const attributeName = String(attribute.Name ?? attribute.FriendlyName ?? '');
      const attributeValues = ensureArray(attribute.AttributeValue)
        .map((value) => textValue(value) ?? String(value))
        .filter(Boolean);

      if (attributeName) {
        attributeMap.set(attributeName, attributeValues);
      }
    }

    const emailAttributeName = provider.emailClaim ?? 'email';
    const groupAttributeName = provider.groupClaim ?? 'groups';
    const email =
      attributeMap.get(emailAttributeName)?.[0] ??
      attributeMap.get('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress')?.[0];
    const groups =
      attributeMap.get(groupAttributeName) ??
      attributeMap.get('http://schemas.microsoft.com/ws/2008/06/identity/claims/groups') ??
      [];
    const displayName =
      attributeMap.get('displayName')?.[0] ??
      attributeMap.get('name')?.[0] ??
      attributeMap.get('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name')?.[0] ??
      email;

    if (!nameIdValue || !email) {
      throw new UnauthorizedException('The SAML assertion did not include the required claims.');
    }

    return {
      subject: nameIdValue,
      email: normalizeEmail(email),
      name: normalizeDisplayName(displayName ?? 'Enterprise User'),
      groups
    };
  }

  private toProviderSummary(provider: ProviderRecord): IdentityProviderSummary {
    return IdentityProviderSummarySchema.parse({
      slug: provider.slug,
      displayName: provider.displayName,
      type: provider.type,
      status: provider.status
    });
  }

  private toSessionUser(
    user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'disabledAt' | 'provisionedBy'>,
    provider: ProviderRecord
  ): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      provisionedBy: user.provisionedBy ?? provider.type,
      identityProvider: this.toProviderSummary(provider)
    };
  }

  private isEnterpriseIdentityEnabled() {
    return (
      readBooleanConfig(
        this.configService.get<string | boolean>('ENTERPRISE_IDENTITY_ENABLED', false),
        false
      ) ||
      Boolean(this.configService.get<string>('OIDC_PROVIDER_SLUG')) ||
      Boolean(this.configService.get<string>('SAML_PROVIDER_SLUG'))
    );
  }

  private isEnterpriseIdentityEnforced() {
    const appEnvironment = normalizeAppEnvironment(
      this.configService.get<string>('APP_ENV'),
      this.configService.get<string>('NODE_ENV', 'development')
    );

    return this.isEnterpriseIdentityEnabled() && !['local', 'test'].includes(appEnvironment);
  }

  private isBreakGlassEnabled() {
    return readBooleanConfig(
      this.configService.get<string | boolean>('BREAK_GLASS_LOCAL_LOGIN_ENABLED', false),
      false
    );
  }

  private safeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
