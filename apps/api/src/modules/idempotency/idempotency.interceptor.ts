import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.header('idempotency-key')?.trim();

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }

    const result = await this.idempotencyService.beginRequest({
      scope: request.currentUser?.id ?? 'public',
      idempotencyKey,
      method: request.method,
      path: request.originalUrl.split('?')[0] ?? request.originalUrl,
      fingerprint: this.idempotencyService.createFingerprint({
        actorId: request.currentUser?.id ?? null,
        body: request.body ?? {},
        params: request.params ?? {}
      })
    });

    if (result.kind === 'replay') {
      response.status(result.statusCode);
      return of(result.body);
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.idempotencyService.completeRequest(result.recordId, response.statusCode, body)
        ).pipe(mergeMap(() => of(body)))
      ),
      catchError((error) =>
        from(this.idempotencyService.abandonRequest(result.recordId)).pipe(
          mergeMap(() => throwError(() => error))
        )
      )
    );
  }
}
