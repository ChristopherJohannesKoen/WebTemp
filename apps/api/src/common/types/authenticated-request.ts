import type { Request } from 'express';
import type { SessionUser } from '@packages/shared';

export type AuthenticatedRequest = Request & {
  currentUser?: SessionUser;
  requestId?: string;
  sessionToken?: string;
};
