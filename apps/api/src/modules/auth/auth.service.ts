import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '@packages/shared';
import type { AuthenticatedSession } from '../../common/types/authenticated-request';
import { readBooleanConfig } from '../../common/config/boolean-config';
import { canExposeResetDetails, normalizeAppEnvironment } from '../../common/config/app-environment';
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto, metadata: SessionMetadata) {
    const email = normalizeEmail(dto.email);
    const user = await this.prismaService.user.findUnique({
      where: { email }
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.metricsService.recordAuthEvent('login_failure');
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { ipAddress: metadata.ipAddress ?? null }
    });
    this.metricsService.recordAuthEvent('login_success');

    return this.createAuthResult(user, metadata);
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

  async resetPassword(dto: ResetPasswordDto, metadata: SessionMetadata) {
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

    return this.createAuthResult(user, metadata);
  }

  async issueCsrfToken(sessionId: string) {
    return this.sessionService.issueCsrfToken(sessionId);
  }

  assertCsrfToken(session: AuthenticatedSession | undefined, rawToken: string | undefined) {
    return this.sessionService.assertCsrfToken(session, rawToken);
  }

  async getSessionContextFromToken(
    rawToken: string,
    metadata: SessionMetadata
  ) {
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

  private async createAuthResult(
    user: Pick<User, 'id' | 'email' | 'name' | 'role'> | PublicUserRecord,
    metadata: SessionMetadata
  ) {
    const { token, expiresAt } = await this.sessionService.createSession(user.id, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
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
      this.configService.get<string | boolean>(
        'EXPOSE_DEV_RESET_DETAILS',
        false
      ),
      false
    );

    return exposeDevResetDetails && canExposeResetDetails(appEnvironment);
  }
}
