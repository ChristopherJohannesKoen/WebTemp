import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status
  });
}

describe('clientApiRequest', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retries an unsafe request once when the server returns csrf_invalid', async () => {
    const firstCsrfToken = 'csrf-token-one-1234567890abcdef123456';
    const secondCsrfToken = 'csrf-token-two-1234567890abcdef123456';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: firstCsrfToken }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 403,
            message: 'A valid CSRF token is required.',
            code: 'csrf_invalid',
            errors: []
          },
          403
        )
      )
      .mockResolvedValueOnce(jsonResponse({ csrfToken: secondCsrfToken }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal('fetch', fetchMock);

    const { clientApiRequest } = await import('../lib/client-api');

    await expect(
      clientApiRequest<{ ok: boolean }>('/api/projects/project_1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated project' })
      })
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-CSRF-Token')).toBe(
      firstCsrfToken
    );
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('X-CSRF-Token')).toBe(
      secondCsrfToken
    );
  });

  it('does not replay a generic forbidden mutation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ csrfToken: 'csrf-token-1234567890abcdef123456' })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 403,
            message: 'You do not have permission to modify this project.',
            code: 'forbidden',
            errors: []
          },
          403
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const { clientApiRequest } = await import('../lib/client-api');

    await expect(
      clientApiRequest('/api/projects/project_1', {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: true })
      })
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
