import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionAuthMethod, SessionAuthReason } from '@packages/shared';

type RequestContextState = {
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorId?: string | null;
  authMechanism?: SessionAuthMethod | null;
  authReason?: SessionAuthReason | null;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(context: RequestContextState, callback: () => T) {
    return this.storage.run(context, callback);
  }

  get() {
    return this.storage.getStore();
  }

  set(values: RequestContextState) {
    const current = this.storage.getStore();

    if (!current) {
      return;
    }

    Object.assign(current, values);
  }
}
