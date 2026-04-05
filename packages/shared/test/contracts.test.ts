import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  AuthPayloadSchema,
  ProjectListQuerySchema,
  ProjectUpsertPayloadSchema,
  SessionUserSchema,
  SignupPayloadSchema
} from '../src/index';

describe('shared contracts', () => {
  it('accepts valid signup payloads', () => {
    const payload = SignupPayloadSchema.parse({
      name: 'Avery Parker',
      email: 'avery@example.com',
      password: 'password123'
    });

    expect(payload.email).toBe('avery@example.com');
  });

  it('rejects invalid auth payloads', () => {
    expect(() =>
      AuthPayloadSchema.parse({
        email: 'invalid',
        password: 'short'
      })
    ).toThrow();
  });

  it('applies sensible defaults to project list queries', () => {
    const query = ProjectListQuerySchema.parse({});

    expect(query).toMatchObject({
      includeArchived: false,
      limit: 12
    });
  });

  it('normalizes optional project description fields', () => {
    const payload = ProjectUpsertPayloadSchema.parse({
      name: 'Starter project',
      description: '',
      status: 'active'
    });

    expect(payload.description).toBe('');
  });

  it('requires a valid session user payload', () => {
    expect(() =>
      SessionUserSchema.parse({
        id: 'user_1',
        email: 'owner@example.com',
        name: '',
        role: 'owner'
      })
    ).not.toThrow();
  });

  it('accepts API errors with machine-readable codes', () => {
    expect(() =>
      ApiErrorSchema.parse({
        statusCode: 403,
        message: 'Forbidden',
        code: 'forbidden',
        errors: [],
        requestId: 'request_1'
      })
    ).not.toThrow();
  });
});
