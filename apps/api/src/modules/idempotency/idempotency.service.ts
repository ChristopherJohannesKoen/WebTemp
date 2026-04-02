import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type BeginRequestInput = {
  scope: string;
  idempotencyKey: string;
  method: string;
  path: string;
  fingerprint: string;
};

type BeginRequestResult =
  | {
      kind: 'replay';
      statusCode: number;
      body: unknown;
    }
  | {
      kind: 'new';
      recordId: string;
    };

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async beginRequest(input: BeginRequestInput): Promise<BeginRequestResult> {
    await this.prismaService.idempotencyRequest.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    try {
      const record = await this.prismaService.idempotencyRequest.create({
        data: {
          scope: input.scope,
          idempotencyKey: input.idempotencyKey,
          method: input.method,
          path: input.path,
          fingerprint: input.fingerprint,
          expiresAt: new Date(Date.now() + this.getIdempotencyTtlSeconds() * 1000)
        }
      });

      return {
        kind: 'new',
        recordId: record.id
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingRecord = await this.prismaService.idempotencyRequest.findUnique({
          where: {
            scope_idempotencyKey_method_path: {
              scope: input.scope,
              idempotencyKey: input.idempotencyKey,
              method: input.method,
              path: input.path
            }
          }
        });

        if (!existingRecord) {
          throw new ConflictException('Unable to resolve the idempotent request state.');
        }

        if (existingRecord.fingerprint !== input.fingerprint) {
          throw new ConflictException(
            'This Idempotency-Key has already been used for a different request payload.'
          );
        }

        if (existingRecord.status === 'completed') {
          return {
            kind: 'replay',
            statusCode: existingRecord.responseStatusCode ?? 200,
            body: existingRecord.responseBody ?? null
          };
        }

        throw new ConflictException('A matching request is already in progress.');
      }

      throw error;
    }
  }

  async completeRequest(recordId: string, statusCode: number, body: unknown) {
    await this.prismaService.idempotencyRequest.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        responseStatusCode: statusCode,
        responseBody: this.toJsonValue(body),
        completedAt: new Date()
      }
    });
  }

  async abandonRequest(recordId: string) {
    await this.prismaService.idempotencyRequest.deleteMany({
      where: {
        id: recordId,
        status: 'pending'
      }
    });
  }

  createFingerprint(payload: unknown) {
    return JSON.stringify(this.sortValue(payload));
  }

  private toJsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sortValue(entry));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return accumulator;
        }, {});
    }

    return value;
  }

  private getIdempotencyTtlSeconds() {
    return Number(this.configService.get<string>('IDEMPOTENCY_TTL_SECONDS', '86400'));
  }
}
