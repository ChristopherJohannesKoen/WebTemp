import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type {
  SessionAuthMethod,
  SessionAuthReason,
  SessionUser,
  StepUpResponse
} from '@packages/shared';
import type { AuthenticatedSession } from '../../common/types/authenticated-request';
import { readBooleanConfig } from '../../common/config/boolean-config';
import {
  canExposeResetDetails,
  normalizeAppEnvironment
} from '../../common/config/app-environment';
import { publicUserSelect, type PublicUserRecord } from '../../common/prisma/public-selects';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDisplayName, normalizeEmail } from './auth.helpers';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { SignupDto } from './dto/signup.dto';
import { SessionService } from './session.service';

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  authMethod?: SessionAuthMethod;
  authReason?: SessionAuthReason;
  identityProviderId?: string | null;
  externalSubject?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
    private readonly metricsService: MetricsService
  ) {}

  async signUp(dto: SignupDto, metadata: SessionMetadata) {
    this.assertLocalAccountProvisioningAllowed();
    const email = normalizeEmail(dto.email);

    try {
      const user = await this.prismaService.user.create({
        data: {
          email,
          name: normalizeDisplayName(dto.name),
          role: 'member',
          passwordHash: await this.hashPassword(dto.password)
        },
        select: publicUserSelect
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'auth.signup',
        targetType: 'user',
        targetId: user.id,
        metadata: { role: user.role }
      });
      this.metricsService.recordAuthEvent('signup_success');

      return this.createAuthResult(user, metadata);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto, metadata: SessionMetadata) {
    this.assertLocalPasswordAuthAllowed(false);
    return this.authenticateLocalUser(dto, metadata, {
      authMethod: 'local',
      authReason: 'local_login',
      auditAction: 'auth.login',
      metricEvent: 'login_success'
    });
  }

  async breakGlassLogin(dto: LoginDto, metadata: SessionMetadata) {
    this.assertBreakGlassAllowed();

    const result = await this.authenticateLocalUser(dto, metadata, {
      authMethod: 'break_glass',
      authReason: 'break_glass',
      auditAction: 'auth.break_glass_login',
      metricEvent: 'break_glass_login'
    });

    if (result.user.role !== 'owner') {
      throw new ForbiddenException('Break-glass login is restricted to owners.');
    }

    return result;
  }

  async completeStepUp(
    currentUser: SessionUser,
    currentSession: AuthenticatedSession,
    password: string
  ): Promise<StepUpResponse> {
    if (currentUser.role !== 'owner') {
      throw new ForbiddenException('Only owners can perform a privileged step-up.');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: currentUser.id }
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('The current password is invalid.');
    }

    const stepUpExpiresAt = new Date(Date.now() + this.getOwnerStepUpWindowMs());
    await this.sessionService.markStepUpCompleted(currentSession.id, stepUpExpiresAt);

    this.metricsService.recordAuthEvent('step_up_completed');
    await this.auditService.log({
      actorId: currentUser.id,
      action: 'auth.step_up_completed',
      targetType: 'session',
      targetId: currentSession.id,
      eventCategory: 'security',
      outcome: 'success',
      authMechanism: currentSession.authMethod
    });

    return {
      ok: true,
      stepUpExpiresAt: stepUpExpiresAt.toISOString()
    };
  }

  async loginWithEnterpriseIdentity(
    user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'disabledAt' | 'provisionedBy'>,
    metadata: SessionMetadata & {
      authMethod: SessionAuthMethod;
      authReason: SessionAuthReason;
      identityProviderId: string;
      externalSubject: string;
    }
  ) {
    const { token, expiresAt } = await this.sessionService.createSession(user.id, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        disabledAt: user.disabledAt?.toISOString() ?? null,
        provisionedBy: user.provisionedBy ?? null,
        identityProvider: null
      },
      token,
      expiresAt
    };
  }

  private async authenticateLocalUser(
    dto: LoginDto,
    metadata: SessionMetadata,
    options: {
      authMethod: SessionAuthMethod;
      authReason: SessionAuthReason;
      auditAction: 'auth.login' | 'auth.break_glass_login';
      metricEvent: string;
    }
  ) {
    const email = normalizeEmail(dto.email);
    const user = await this.prismaService.user.findUnique({
      where: { email }
    });

    if (
      !user ||
      !user.passwordHash ||
      user.disabledAt ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      this.metricsService.recordAuthEvent('login_failure');
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.auditService.log({
      actorId: user.id,
      action: options.auditAction,
      targetType: 'user',
      targetId: user.id,
      eventCategory: 'authentication',
      outcome: 'success',
      authMechanism: options.authMethod,
      metadata: { ipAddress: metadata.ipAddress ?? null }
    });
    this.metricsService.recordAuthEvent(options.metricEvent);

    return this.createAuthResult(user, {
      ...metadata,
      authMethod: options.authMethod,
      authReason: options.authReason
    });
  }

  async logout(sessionToken: string | undefined, actorId?: string) {
    if (!sessionToken) {
      return;
    }

    await this.sessionService.destroySession(sessionToken);

    if (actorId) {
      this.metricsService.recordAuthEvent('logout');
      await this.auditService.log({
        actorId,
        action: 'auth.logout',
        targetType: 'user',
        targetId: actorId
      });
    }
  }

  async logoutAll(currentUser: SessionUser) {
    await this.sessionService.destroyAllSessions(currentUser.id);
    this.metricsService.recordAuthEvent('logout_all');

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'auth.logout_all',
      targetType: 'user',
      targetId: currentUser.id
    });

    return { ok: true };
  }

  async listSessions(currentUser: SessionUser, currentSessionId?: string) {
    return this.sessionService.listSessions(currentUser, currentSessionId);
  }

  async revokeSession(currentUser: SessionUser, sessionId: string, currentSessionId?: string) {
    const result = await this.sessionService.revokeSession(
      currentUser,
      sessionId,
      currentSessionId
    );

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'auth.session_revoked',
      targetType: 'session',
      targetId: sessionId,
      metadata: {
        revokedCurrent: result.revokedCurrent
      }
    });
    this.metricsService.recordAuthEvent('session_revoked');

    return result;
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    this.assertPasswordResetAllowed();
    const email = normalizeEmail(dto.email);
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true
      }
    });

    const message =
      'If the account exists, a password reset link has been generated for this environment.';
    this.metricsService.recordAuthEvent('password_reset_requested');

    if (!user) {
      return { message };
    }

    const rawToken = this.generateToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prismaService.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(rawToken),
        userId: user.id,
        expiresAt
      }
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.password_reset_requested',
      targetType: 'user',
      targetId: user.id
    });

    if (!this.shouldExposeResetDetails()) {
      return { message };
    }

    this.metricsService.recordAuthEvent('password_reset_details_exposed');
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    return {
      message,
      resetToken: rawToken,
      resetUrl: `${appUrl}/reset-password?token=${rawToken}`
    };
  }

  async completePasswordReset(dto: ResetPasswordDto) {
    this.assertPasswordResetAllowed();
    const tokenHash = this.hashToken(dto.token);
    const tokenRecord = await this.prismaService.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Password reset link is invalid or expired.');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prismaService.$transaction(async (transaction) => {
      await transaction.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() }
      });

      const updatedUser = await transaction.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
        select: publicUserSelect
      });

      await transaction.session.deleteMany({
        where: { userId: tokenRecord.userId }
      });

      return updatedUser;
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.password_reset_completed',
      targetType: 'user',
      targetId: user.id
    });
    this.metricsService.recordAuthEvent('password_reset_completed');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  async issueCsrfToken(sessionId: string) {
    return this.sessionService.issueCsrfToken(sessionId);
  }

  assertCsrfToken(session: AuthenticatedSession | undefined, rawToken: string | undefined) {
    return this.sessionService.assertCsrfToken(session, rawToken);
  }

  async getSessionContextFromToken(rawToken: string, metadata: SessionMetadata) {
    return this.sessionService.resolveSessionContext(rawToken, metadata);
  }

  async getSessionUserFromToken(rawToken: string) {
    return this.sessionService.resolveSessionUser(rawToken);
  }

  getCookieOptions(expiresAt: Date) {
    return this.sessionService.getCookieOptions(expiresAt);
  }

  getClearCookieOptions() {
    return this.sessionService.getClearCookieOptions();
  }

  getCookieName() {
    return this.sessionService.getCookieName();
  }

  encodeSessionCookieToken(rawToken: string) {
    return this.sessionService.encodeSessionCookieToken(rawToken);
  }

  async issueSessionForUser(userId: string, metadata: SessionMetadata) {
    return this.sessionService.createSession(userId, metadata);
  }

  private async createAuthResult(
    user:
      | Pick<User, 'id' | 'email' | 'name' | 'role' | 'disabledAt' | 'provisionedBy'>
      | PublicUserRecord,
    metadata: SessionMetadata & {
      authMethod?: SessionAuthMethod;
      authReason?: SessionAuthReason;
      identityProviderId?: string | null;
      externalSubject?: string | null;
    }
  ) {
    const { token, expiresAt } = await this.sessionService.createSession(user.id, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        disabledAt: user.disabledAt?.toISOString() ?? null,
        provisionedBy: user.provisionedBy ?? null,
        identityProvider: null
      },
      token,
      expiresAt
    };
  }

  private async hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: Number(this.configService.get<string>('ARGON2_MEMORY_COST', '19456'))
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private shouldExposeResetDetails() {
    const nodeEnvironment = this.configService.get<string>('NODE_ENV', 'development');
    const appEnvironment = normalizeAppEnvironment(
      this.configService.get<string>('APP_ENV'),
      nodeEnvironment
    );
    const exposeDevResetDetails = readBooleanConfig(
      this.configService.get<string | boolean>('EXPOSE_DEV_RESET_DETAILS', false),
      false
    );

    return exposeDevResetDetails && canExposeResetDetails(appEnvironment);
  }

  private assertLocalAccountProvisioningAllowed() {
    if (this.isEnterpriseIdentityEnforced()) {
      throw new ForbiddenException(
        'Self-service account creation is disabled when enterprise identity is enabled.'
      );
    }
  }

  private assertLocalPasswordAuthAllowed(forBreakGlass: boolean) {
    if (!this.isEnterpriseIdentityEnforced()) {
      return;
    }

    if (forBreakGlass && this.isBreakGlassEnabled()) {
      return;
    }

    throw new ForbiddenException(
      'Local password authentication is disabled for this environment. Use enterprise sign-in.'
    );
  }

  private assertBreakGlassAllowed() {
    if (!this.isEnterpriseIdentityEnabled() || !this.isBreakGlassEnabled()) {
      throw new ForbiddenException('Break-glass access is not enabled in this environment.');
    }
  }

  private assertPasswordResetAllowed() {
    if (this.isEnterpriseIdentityEnforced()) {
      throw new ForbiddenException(
        'Password reset is disabled when enterprise identity is enabled.'
      );
    }
  }

  private isEnterpriseIdentityEnabled() {
    return readBooleanConfig(
      this.configService.get<string | boolean>('ENTERPRISE_IDENTITY_ENABLED', false),
      false
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

  private getOwnerStepUpWindowMs() {
    return Number(this.configService.get<string>('OWNER_STEP_UP_WINDOW_MS', '900000'));
  }
}
