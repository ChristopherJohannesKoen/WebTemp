import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '@packages/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { SignupDto } from './dto/signup.dto';

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
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
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prismaService.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const role = (await this.prismaService.user.count()) === 0 ? 'owner' : 'member';
    const user = await this.prismaService.user.create({
      data: {
        email,
        name: dto.name.trim(),
        role,
        passwordHash: await this.hashPassword(dto.password)
      }
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.signup',
      targetType: 'user',
      targetId: user.id,
      metadata: { role }
    });

    return this.createAuthResult(user, metadata);
  }

  async login(dto: LoginDto, metadata: SessionMetadata) {
    const email = dto.email.trim().toLowerCase();
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

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
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

  async getSessionUserFromToken(rawToken: string): Promise<SessionUser | undefined> {
    const session = await this.prismaService.session.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: true }
    });

    if (!session) {
      return undefined;
    }

    if (session.expiresAt < new Date()) {
      await this.prismaService.session.delete({ where: { id: session.id } });
      return undefined;
    }

    await this.prismaService.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    return this.toSessionUser(session.user);
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

    await this.prismaService.session.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null
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
}
