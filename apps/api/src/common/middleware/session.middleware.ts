import { Injectable, NestMiddleware } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const prisma = new PrismaClient();

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  async use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ultimate_template_session';
    const token = request.cookies?.[cookieName];

    if (!token || typeof token !== 'string') {
      next();
      return;
    }

    request.sessionToken = token;
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true }
    });

    if (!session) {
      next();
      return;
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      next();
      return;
    }

    const now = new Date();
    const shouldRotate =
      now.getTime() - session.lastRotatedAt.getTime() >= getSessionRotationWindowMs();
    const rotatedToken = shouldRotate ? generateToken() : undefined;

    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: now,
        lastRotatedAt: shouldRotate ? now : undefined,
        tokenHash: rotatedToken ? hashToken(rotatedToken) : undefined,
        ipAddress: request.ip ?? session.ipAddress ?? null,
        userAgent: request.header('user-agent') ?? session.userAgent ?? null
      }
    });

    request.currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role
    };
    request.currentSession = {
      id: updatedSession.id,
      userId: updatedSession.userId,
      csrfTokenHash: updatedSession.csrfTokenHash,
      expiresAt: updatedSession.expiresAt,
      createdAt: updatedSession.createdAt,
      lastUsedAt: updatedSession.lastUsedAt,
      lastRotatedAt: updatedSession.lastRotatedAt,
      ipAddress: updatedSession.ipAddress,
      userAgent: updatedSession.userAgent
    };

    if (rotatedToken) {
      request.sessionToken = rotatedToken;
      response.cookie(cookieName, rotatedToken, getCookieOptions(updatedSession.expiresAt));
    }

    next();
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

function getSessionRotationWindowMs() {
  return Number(process.env.SESSION_ROTATION_MS ?? '43200000');
}

function getCookieOptions(expiresAt: Date) {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    expires: expiresAt,
    path: '/'
  };
}
