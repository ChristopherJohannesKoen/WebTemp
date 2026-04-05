import { Injectable } from '@nestjs/common';

type Failpoint = {
  body?: Record<string, unknown>;
  delayMs: number;
  method: string;
  path: string;
  remainingHits: number;
  statusCode: number;
};

@Injectable()
export class E2EFailpointService {
  private readonly failpoints = new Map<string, Failpoint>();

  setFailpoint(failpoint: {
    body?: Record<string, unknown>;
    delayMs?: number;
    method: string;
    path: string;
    statusCode: number;
    times?: number;
  }) {
    const key = this.getKey(failpoint.method, failpoint.path);
    this.failpoints.set(key, {
      ...failpoint,
      delayMs: failpoint.delayMs ?? 0,
      remainingHits: failpoint.times ?? 1
    });
  }

  clearAll() {
    this.failpoints.clear();
  }

  consume(method: string, path: string) {
    const key = this.getKey(method, path);
    const failpoint = this.failpoints.get(key);

    if (!failpoint) {
      return undefined;
    }

    failpoint.remainingHits -= 1;

    if (failpoint.remainingHits <= 0) {
      this.failpoints.delete(key);
    } else {
      this.failpoints.set(key, failpoint);
    }

    return failpoint;
  }

  private getKey(method: string, path: string) {
    return `${method.toUpperCase()}:${path}`;
  }
}
