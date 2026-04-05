import { apiContract } from '@packages/contracts';
import { z } from 'zod';
import { ResponseValidationError, UnknownStatusError } from '@ts-rest/core';
import { describe, expect, it } from 'vitest';
import {
  ApiContractError,
  ApiRequestError,
  toApiError,
  unwrapContractResponse
} from '../lib/api-error';

describe('api error helpers', () => {
  it('unwraps successful contract responses', () => {
    expect(
      unwrapContractResponse<{ ok: boolean }>(
        {
          status: 200,
          body: { ok: true },
          headers: new Headers()
        },
        [200]
      )
    ).toEqual({ ok: true });
  });

  it('throws structured API errors for failing contract responses', () => {
    expect(() =>
      unwrapContractResponse(
        {
          status: 401,
          body: {
            statusCode: 401,
            message: 'Unauthorized',
            code: 'auth_required',
            errors: []
          },
          headers: new Headers()
        },
        [200]
      )
    ).toThrowError(ApiRequestError);
  });

  it('fails fast when an error payload does not match the contract', () => {
    expect(() =>
      unwrapContractResponse(
        {
          status: 503,
          body: '<html>bad gateway</html>',
          headers: new Headers()
        },
        [200]
      )
    ).toThrowError(ApiContractError);
  });

  it('maps ts-rest response validation failures into contract errors', () => {
    const zodError = z.object({ ok: z.boolean() }).safeParse({ ok: 'yes' });

    if (zodError.success) {
      throw new Error('Expected schema parsing to fail for the invalid payload.');
    }

    const error = toApiError(new ResponseValidationError(apiContract.auth.me, zodError.error));

    expect(error).toBeInstanceOf(ApiContractError);
    expect(error.code).toBe('invalid_api_response');
  });

  it('maps unknown status errors with structured payloads into API errors', () => {
    const error = toApiError(
      new UnknownStatusError(
        {
          status: 418,
          body: {
            statusCode: 418,
            message: 'Teapot',
            code: 'teapot',
            errors: []
          }
        },
        ['200']
      )
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe('teapot');
    expect(error.statusCode).toBe(418);
  });

  it('normalizes unknown thrown values', () => {
    const error = toApiError(new Error('boom'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe('Something went wrong.');
  });
});
