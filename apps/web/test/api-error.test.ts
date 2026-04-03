import { describe, expect, it } from 'vitest';
import { ApiRequestError, parseApiResponse, toApiError } from '../lib/api-error';

describe('api error helpers', () => {
  it('parses successful JSON responses', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200
    });

    await expect(parseApiResponse<{ ok: boolean }>(response)).resolves.toEqual({ ok: true });
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

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      code: 'auth_required',
      statusCode: 401
    });
  });

  it('normalizes unknown thrown values', () => {
    const error = toApiError(new Error('boom'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe('Something went wrong.');
  });
});
