import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SessionSummary, SessionUser } from '@packages/shared';
import type { AuthenticatedSession } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDisplayName, normalizeEmail } from './auth.helpers';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { SignupDto } from './dto/signup.dto';

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SessionContext = {
  user: SessionUser;
  session: AuthenticatedSession;
  rotatedToken?: string;
};

@Injectable()
export class AuthService {
  private readonly sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  async signUp(dto: SignupDto, metadata: SessionMetadata) {
    const email = normalizeEmail(dto.email);

    try {
      const user = await this.prismaService.$transaction(
        async (transaction) => {
          const existingUser = await transaction.user.findUnique({
            where: { email }
          });

          if (existingUser) {
            throw new ConflictException('An account with this email already exists.');
          }

          const role = (await transaction.user.count()) === 0 ? 'owner' : 'member';

          return transaction.user.create({
            data: {
              email,
              name: normalizeDisplayName(dto.name),
              role,
              passwordHash: await this.hashPassword(dto.password)
            }
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      await this.auditService.log({
        actorId: user.id,
        action: 'auth.signup',
        targetType: 'user',
        targetId: user.id,
        metadata: { role: user.role }
      });

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
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { ipAddress: metadata.ipAddress ?? null }
    });

    return this.createAuthResult(user, metadata);
  }

  async logout(sessionToken: string | undefined, actorId?: string) {
    if (!sessionToken) {
      return;
    }

    await this.prismaService.session.deleteMany({
      where: { tokenHash: this.hashToken(sessionToken) }
    });

    if (actorId) {
      await this.auditService.log({
        actorId,
        action: 'auth.logout',
        targetType: 'user',
        targetId: actorId
      });
    }
  }

  async logoutAll(currentUser: SessionUser) {
    await this.prismaService.session.deleteMany({
      where: { userId: currentUser.id }
    });

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'auth.logout_all',
      targetType: 'user',
      targetId: currentUser.id
    });

    return { ok: true };
  }

  async listSessions(currentUser: SessionUser, currentSessionId?: string) {
    const sessions = await this.prismaService.session.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      items: sessions.map((session) =>
        this.toSessionSummary(session, currentSessionId)
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

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'auth.session_revoked',
      targetType: 'session',
      targetId: session.id,
      metadata: {
        revokedCurrent: session.id === currentSessionId
      }
    });

    return {
      ok: true,
      revokedCurrent: session.id === currentSessionId
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prismaService.user.findUnique({
      where: { email }
    });

    const message =
      'If the account exists, a password reset link has been generated for this environment.';

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

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return { message };
    }

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
        data: { passwordHash }
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

    return this.createAuthResult(user, metadata);
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

  async getSessionContextFromToken(
    rawToken: string,
    metadata: SessionMetadata
  ): Promise<SessionContext | undefined> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prismaService.session.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session) {
      return undefined;
    }

    if (session.expiresAt < new Date()) {
      await this.prismaService.session.delete({ where: { id: session.id } });
      return undefined;
    }

    const now = new Date();
    const shouldRotate =
      now.getTime() - session.lastRotatedAt.getTime() >= this.getSessionRotationWindowMs();
    let rotatedToken: string | undefined;

    const updatedSession = await this.prismaService.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: now,
        lastRotatedAt: shouldRotate ? now : undefined,
        tokenHash: shouldRotate ? this.hashToken((rotatedToken = this.generateToken())) : undefined,
        ipAddress: metadata.ipAddress ?? session.ipAddress ?? null,
        userAgent: metadata.userAgent ?? session.userAgent ?? null
      }
    });

    return {
      user: this.toSessionUser(session.user),
      session: this.toAuthenticatedSession(updatedSession),
      rotatedToken
    };
  }

  async getSessionUserFromToken(rawToken: string) {
    return (await this.getSessionContextFromToken(rawToken, {}))?.user;
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

  private async createAuthResult(user: User, metadata: SessionMetadata) {
    const { token, expiresAt } = await this.createSession(user.id, metadata);

    return {
      user: this.toSessionUser(user),
      token,
      expiresAt
    };
  }

  private async createSession(userId: string, metadata: SessionMetadata) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.sessionLifetimeMs);
    const csrfTokenSeed = this.generateToken();

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          tokenHash: this.hashToken(token),
          csrfTokenHash: this.hashToken(csrfTokenSeed),
          userId,
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

    return { token, expiresAt };
  }

  private toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  private toAuthenticatedSession(session: {
    id: string;
    userId: string;
    csrfTokenHash: string;
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
    },
    currentSessionId?: string
  ): SessionSummary {
    return {
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: session.id === currentSessionId
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

  private hashMatches(expectedHash: string, candidateHash: string) {
    if (expectedHash.length !== candidateHash.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(candidateHash));
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private getSessionRotationWindowMs() {
    return Number(this.configService.get<string>('SESSION_ROTATION_MS', '43200000'));
  }

  private getSessionMaxActive() {
    return Number(this.configService.get<string>('SESSION_MAX_ACTIVE', '5'));
  }
}
