import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  ApiContractError,
  ApiRequestError,
  parseEmptyResponse,
  parseJsonResponse,
  parseTextResponse,
  toApiError
} from '../lib/api-error';

describe('api error helpers', () => {
  it('parses successful JSON responses with a schema', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200
    });

    await expect(
      parseJsonResponse(response, z.object({ ok: z.boolean() }))
    ).resolves.toEqual({ ok: true });
  });

  it('throws structured API errors for failing JSON responses', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 401,
        message: 'Unauthorized',
        code: 'auth_required',
        errors: []
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 401
      }
    );

    await expect(parseJsonResponse(response)).rejects.toMatchObject({
      code: 'auth_required',
      statusCode: 401
    });
  });

  it('fails fast when a JSON endpoint returns an unexpected content type', async () => {
    const response = new Response('<html>bad gateway</html>', {
      headers: { 'content-type': 'text/html' },
      status: 503
    });

    await expect(parseJsonResponse(response)).rejects.toBeInstanceOf(ApiContractError);
  });

  it('fails fast when a successful JSON payload violates the expected schema', async () => {
    const response = new Response(JSON.stringify({ ok: 'yes' }), {
      headers: { 'content-type': 'application/json' },
      status: 200
    });

    await expect(
      parseJsonResponse(response, z.object({ ok: z.boolean() }))
    ).rejects.toBeInstanceOf(ApiContractError);
  });

  it('supports explicit text and empty response parsers', async () => {
    await expect(
      parseTextResponse(
        new Response('plain text payload', {
          headers: { 'content-type': 'text/plain' },
          status: 200
        })
      )
    ).resolves.toBe('plain text payload');

    await expect(
      parseEmptyResponse(
        new Response(null, {
          status: 204
        })
      )
    ).resolves.toBeUndefined();
  });

  it('normalizes unknown thrown values', () => {
    const error = toApiError(new Error('boom'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe('Something went wrong.');
  });
});
