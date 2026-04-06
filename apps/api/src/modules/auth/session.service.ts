import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import type {
  IdentityProviderSummary,
  SessionAuthMethod,
  SessionAuthReason,
  SessionSummary,
  SessionUser
} from '@packages/shared';
import type { IdentityProviderType, User } from '@prisma/client';
import { publicUserSelect, type PublicUserRecord } from '../../common/prisma/public-selects';
import type {
  AuthenticatedRequest,
  AuthenticatedSession
} from '../../common/types/authenticated-request';
import { SecretService } from '../../common/secrets/secret.service';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  authMethod?: SessionAuthMethod;
  authReason?: SessionAuthReason;
  identityProviderId?: string | null;
  identityProvider?: IdentityProviderSummary | null;
  externalSubject?: string | null;
};

type SessionContext = {
  user: SessionUser;
  session: AuthenticatedSession;
  rotatedToken?: string;
};

@Injectable()
export class SessionService {
  private readonly sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly secretService: SecretService
  ) {}

  async createSession(userId: string, metadata: SessionMetadata) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.sessionLifetimeMs);
    const csrfTokenSeed = this.generateToken();

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          tokenHash: this.hashToken(token),
          csrfTokenHash: this.hashToken(csrfTokenSeed),
          userId,
          authMethod: metadata.authMethod ?? 'local',
          authReason: metadata.authReason ?? 'local_login',
          identityProviderId: metadata.identityProviderId ?? null,
          externalSubject: metadata.externalSubject ?? null,
          expiresAt,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null
        }
      });

      const overflowSessions = await transaction.session.findMany({
        where: { userId },
        orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
        skip: this.getSessionMaxActive(),
        select: { id: true }
      });

      if (overflowSessions.length > 0) {
        await transaction.session.deleteMany({
          where: {
            id: {
              in: overflowSessions.map((session) => session.id)
            }
          }
        });
      }
    });
    this.metricsService.recordSessionEvent('created');

    return { token, expiresAt };
  }

  async destroySession(rawToken: string | undefined) {
    if (!rawToken) {
      return;
    }

    await this.prismaService.session.deleteMany({
      where: { tokenHash: this.hashToken(rawToken) }
    });
    this.metricsService.recordSessionEvent('destroyed');
  }

  async destroyAllSessions(userId: string) {
    await this.prismaService.session.deleteMany({
      where: { userId }
    });
    this.metricsService.recordSessionEvent('destroyed_all');
  }

  async listSessions(currentUser: SessionUser, currentSessionId?: string) {
    const sessions = await this.prismaService.session.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        identityProvider: {
          select: {
            slug: true,
            displayName: true,
            type: true,
            status: true
          }
        }
      }
    });

    return {
      items: sessions.map((session) =>
        this.toSessionSummary(
          {
            ...session,
            identityProvider: session.identityProvider
              ? this.toIdentityProviderSummary(session.identityProvider)
              : null
          },
          currentSessionId
        )
      )
    };
  }

  async revokeSession(currentUser: SessionUser, sessionId: string, currentSessionId?: string) {
    const session = await this.prismaService.session.findFirst({
      where: {
        id: sessionId,
        userId: currentUser.id
      }
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.prismaService.session.delete({
      where: { id: session.id }
    });
    this.metricsService.recordSessionEvent('revoked');

    return {
      ok: true,
      revokedCurrent: session.id === currentSessionId
    };
  }

  async issueCsrfToken(sessionId: string) {
    const rawToken = this.generateToken();

    await this.prismaService.session.update({
      where: { id: sessionId },
      data: {
        csrfTokenHash: this.hashToken(rawToken)
      }
    });

    return rawToken;
  }

  assertCsrfToken(session: AuthenticatedSession | undefined, rawToken: string | undefined) {
    if (!session || !rawToken) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }

    if (!this.hashMatches(session.csrfTokenHash, this.hashToken(rawToken))) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
  }

  async resolveSessionContext(
    rawToken: string,
    metadata: SessionMetadata
  ): Promise<SessionContext | undefined> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prismaService.session.findUnique({
      where: { tokenHash },
      include: {
        user: { select: publicUserSelect },
        identityProvider: {
          select: {
            slug: true,
            displayName: true,
            type: true,
            status: true
          }
        }
      }
    });

    if (!session) {
      this.metricsService.recordSessionEvent('lookup_miss');
      return undefined;
    }

    if (session.expiresAt < new Date()) {
      await this.prismaService.session.delete({ where: { id: session.id } });
      this.metricsService.recordSessionEvent('expired');
      return undefined;
    }

    if (session.user.disabledAt) {
      await this.prismaService.session.delete({ where: { id: session.id } });
      this.metricsService.recordSessionEvent('disabled_user');
      return undefined;
    }

    const now = new Date();
    const shouldRotate =
      now.getTime() - session.lastRotatedAt.getTime() >= this.getSessionRotationWindowMs();
    const shouldTouch =
      now.getTime() - session.lastUsedAt.getTime() >= this.getSessionTouchIntervalMs();
    let rotatedToken: string | undefined;
    const shouldPersistSession = shouldRotate || shouldTouch;
    let updatedSession = session;

    if (shouldPersistSession) {
      const candidateRotatedToken = shouldRotate ? this.generateToken() : undefined;
      const updateResult = await this.prismaService.session.updateMany({
        where: {
          id: session.id,
          tokenHash
        },
        data: {
          lastUsedAt: now,
          lastRotatedAt: shouldRotate ? now : undefined,
          tokenHash: candidateRotatedToken ? this.hashToken(candidateRotatedToken) : undefined,
          ipAddress: metadata.ipAddress ?? session.ipAddress ?? null,
          userAgent: metadata.userAgent ?? session.userAgent ?? null
        }
      });

      if (updateResult.count > 0) {
        rotatedToken = candidateRotatedToken;
        updatedSession = {
          ...session,
          lastUsedAt: now,
          lastRotatedAt: shouldRotate ? now : session.lastRotatedAt,
          ipAddress: metadata.ipAddress ?? session.ipAddress ?? null,
          userAgent: metadata.userAgent ?? session.userAgent ?? null
        };
      }
    }

    if (shouldTouch && updatedSession !== session) {
      this.metricsService.recordSessionEvent('touched');
    }

    if (shouldRotate && rotatedToken) {
      this.metricsService.recordSessionEvent('rotated');
    }

    return {
      user: this.toSessionUser(
        session.user,
        session.identityProvider ? this.toIdentityProviderSummary(session.identityProvider) : null
      ),
      session: this.toAuthenticatedSession(updatedSession),
      rotatedToken
    };
  }

  async resolveSessionUser(rawToken: string) {
    return (await this.resolveSessionContext(rawToken, {}))?.user;
  }

  getCookieOptions(expiresAt: Date) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProduction,
      expires: expiresAt,
      path: '/'
    };
  }

  getClearCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProduction,
      path: '/'
    };
  }

  getCookieName() {
    return this.configService.get<string>('SESSION_COOKIE_NAME', 'ultimate_template_session');
  }

  encodeSessionCookieToken(rawToken: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getCookieEncryptionKey(), iv);
    const encryptedToken = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, encryptedToken, authTag].map((part) => part.toString('base64url')).join('.');
  }

  decodeSessionCookieToken(cookieValue: string) {
    const [ivValue, encryptedTokenValue, authTagValue] = cookieValue.split('.');

    if (!ivValue || !encryptedTokenValue || !authTagValue) {
      return undefined;
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getCookieEncryptionKey(),
        Buffer.from(ivValue, 'base64url')
      );
      decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedTokenValue, 'base64url')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      return undefined;
    }
  }

  attachSessionToRequest(
    request: AuthenticatedRequest,
    sessionContext: SessionContext | undefined
  ) {
    if (!sessionContext) {
      return;
    }

    request.currentUser = sessionContext.user;
    request.currentSession = sessionContext.session;
    request.sessionToken = sessionContext.rotatedToken ?? request.sessionToken;
  }

  async markStepUpCompleted(sessionId: string, expiresAt: Date) {
    await this.prismaService.session.update({
      where: { id: sessionId },
      data: { stepUpAt: expiresAt }
    });

    this.metricsService.recordSessionEvent('step_up_completed');
  }

  private toIdentityProviderSummary(provider: {
    slug: string;
    displayName: string;
    type: IdentityProviderType;
    status: string;
  }): IdentityProviderSummary {
    return {
      slug: provider.slug,
      displayName: provider.displayName,
      type: provider.type,
      status: provider.status as IdentityProviderSummary['status']
    };
  }

  private toSessionUser(
    user:
      | Pick<User, 'id' | 'email' | 'name' | 'role' | 'disabledAt' | 'provisionedBy'>
      | PublicUserRecord,
    identityProvider?: IdentityProviderSummary | null
  ): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      provisionedBy: (user.provisionedBy as IdentityProviderType | null | undefined) ?? null,
      identityProvider: identityProvider ?? null
    };
  }

  private toAuthenticatedSession(session: {
    id: string;
    userId: string;
    csrfTokenHash: string;
    authMethod: SessionAuthMethod;
    authReason: SessionAuthReason;
    identityProviderId: string | null;
    externalSubject: string | null;
    stepUpAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    lastUsedAt: Date;
    lastRotatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): AuthenticatedSession {
    return {
      id: session.id,
      userId: session.userId,
      csrfTokenHash: session.csrfTokenHash,
      authMethod: session.authMethod,
      authReason: session.authReason,
      identityProviderId: session.identityProviderId,
      externalSubject: session.externalSubject,
      stepUpAt: session.stepUpAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      lastRotatedAt: session.lastRotatedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent
    };
  }

  private toSessionSummary(
    session: {
      id: string;
      createdAt: Date;
      lastUsedAt: Date;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
      authMethod: SessionAuthMethod;
      authReason: SessionAuthReason;
      stepUpAt: Date | null;
      identityProvider?: IdentityProviderSummary | null;
    },
    currentSessionId?: string
  ): SessionSummary {
    return {
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      authMethod: session.authMethod,
      authReason: session.authReason,
      identityProvider: session.identityProvider ?? null,
      stepUpAt: session.stepUpAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: session.id === currentSessionId
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashMatches(expectedHash: string, candidateHash: string) {
    if (expectedHash.length !== candidateHash.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(candidateHash));
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private getCookieEncryptionKey() {
    const encryptionKey = Buffer.from(
      this.secretService.getRequiredSecret('SESSION_COOKIE_ENCRYPTION_KEY'),
      'hex'
    );

    if (encryptionKey.length !== 32) {
      throw new Error(
        'SESSION_COOKIE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).'
      );
    }

    return encryptionKey;
  }

  private getSessionRotationWindowMs() {
    return Number(this.configService.get<string>('SESSION_ROTATION_MS', '43200000'));
  }

  private getSessionTouchIntervalMs() {
    return Number(this.configService.get<string>('SESSION_TOUCH_INTERVAL_MS', '600000'));
  }

  private getSessionMaxActive() {
    return Number(this.configService.get<string>('SESSION_MAX_ACTIVE', '5'));
  }
}
