import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noStoreMock = vi.fn();
const redirectMock = vi.fn((destination: string) => {
  throw new Error(`redirect:${destination}`);
});
let cookieStoreMock = {
  get: vi.fn()
};
const cookiesMock = vi.fn(async () => cookieStoreMock);

vi.mock('next/cache', () => ({
  unstable_noStore: noStoreMock
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status
  });
}

function resetCookieStore() {
  cookieStoreMock = {
    get: vi.fn((name: string) => {
      if (name === 'ultimate_template_session') {
        return { name, value: 'session-token' };
      }

      return undefined;
    })
  };
}

describe('server-api helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    noStoreMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
    cookiesMock.mockClear();
    resetCookieStore();
    process.env.SESSION_COOKIE_NAME = 'ultimate_template_session';
    process.env.API_ORIGIN = 'http://localhost:4000';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns undefined for unauthenticated current-user requests and forwards only the session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          message: 'Authentication required.',
          code: 'auth_required',
          errors: []
        },
        401
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('../lib/server-api');

    await expect(getCurrentUser()).resolves.toBeUndefined();
    expect(noStoreMock).toHaveBeenCalledTimes(1);
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('cookie')).toBe(
      'ultimate_template_session=session-token'
    );
  });

  it('rethrows upstream failures when resolving the current user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 503,
          message: 'The upstream API is unavailable.',
          code: 'upstream_error',
          errors: []
        },
        503
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('../lib/server-api');

    await expect(getCurrentUser()).rejects.toMatchObject({
      code: 'upstream_error',
      statusCode: 503
    });
  });

  it('redirects protected API reads only when the backend returns 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          message: 'Authentication required.',
          code: 'auth_required',
          errors: []
        },
        401
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const { getProjects } = await import('../lib/server-api');

    await expect(getProjects()).rejects.toThrow('redirect:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('preserves forbidden project responses without redirecting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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

    const { getProject } = await import('../lib/server-api');

    await expect(getProject('project_1')).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
