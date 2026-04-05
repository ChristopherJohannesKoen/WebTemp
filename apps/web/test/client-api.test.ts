import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status
  });
}

function projectResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project_1',
    name: 'Updated project',
    description: 'Updated description',
    status: 'active',
    isArchived: false,
    creator: {
      id: 'user_1',
      name: 'Template Owner',
      email: 'owner@example.com',
      role: 'owner'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
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
      .mockResolvedValueOnce(jsonResponse(projectResponse()));

    vi.stubGlobal('fetch', fetchMock);

    const { updateProject } = await import('../lib/client-api');

    await expect(
      updateProject('project_1', {
        name: 'Updated project'
      })
    ).resolves.toMatchObject({
      id: 'project_1',
      name: 'Updated project'
    });

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
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token-1234567890abcdef123456' }))
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

    const { updateProject } = await import('../lib/client-api');

    await expect(
      updateProject('project_1', {
        isArchived: true
      })
    ).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
