import type { Request } from 'express';
import type { SessionUser } from '@packages/shared';

export type AuthenticatedSession = {
  id: string;
  userId: string;
  csrfTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  lastRotatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuthenticatedRequest = Request & {
  currentUser?: SessionUser;
  currentSession?: AuthenticatedSession;
  requestId?: string;
  sessionToken?: string;
};
