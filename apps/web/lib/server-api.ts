import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  AuthResponse,
  Project,
  ProjectListResponse,
  SessionListResponse,
  UserListResponse,
  UserSummary
} from '@packages/shared';
import { ApiRequestError, parseApiResponse } from './api-error';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'ultimate_template_session';

function getFetchOptions(path: string, init?: RequestInit) {
  if (process.env.NODE_ENV === 'test' || process.env.TEMPLATE_E2E === 'true') {
    return { cache: 'no-store' as const };
  }

  const method = init?.method?.toUpperCase() ?? 'GET';

  if (method !== 'GET') {
    return { cache: 'no-store' as const };
  }

  if (
    path.startsWith('/auth/') ||
    path.startsWith('/users/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/projects')
  ) {
    return { cache: 'no-store' as const };
  }

  return {
    next: {
      revalidate: 30
    }
  };
}

async function serverApiRequest<T>(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const headers = new Headers(init?.headers);
  const fetchOptions = getFetchOptions(path, init);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('cookie')) {
    const sessionCookie = cookieStore.get(sessionCookieName);

    if (sessionCookie) {
      headers.set('cookie', `${sessionCookie.name}=${sessionCookie.value}`);
    }
  }

  if ('cache' in fetchOptions && fetchOptions.cache === 'no-store') {
    noStore();
  }

  if (process.env.TEMPLATE_E2E === 'true' && path.startsWith('/projects/') && path.includes('forceError=upstream')) {
    throw new ApiRequestError(
      'The upstream API is unavailable.',
      503,
      [],
      undefined,
      'upstream_error'
    );
  }

  const response = await fetch(`${apiOrigin}/api${path}`, {
    ...init,
    ...fetchOptions,
    headers
  });

  return parseApiResponse<T>(response);
}

async function protectedServerApiRequest<T>(path: string, init?: RequestInit) {
  try {
    return await serverApiRequest<T>(path, init);
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      redirect('/login');
    }

    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const response = await serverApiRequest<AuthResponse>('/auth/me');
    return response.user;
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      return undefined;
    }

    throw error;
  }
}

export async function requireCurrentUser() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  return currentUser;
}

export async function getProjects(query = '') {
  return protectedServerApiRequest<ProjectListResponse>(`/projects${query ? `?${query}` : ''}`);
}

export async function getProject(projectId: string, query = '') {
  return protectedServerApiRequest<Project>(
    `/projects/${projectId}${query ? `?${query}` : ''}`
  );
}

export async function getUsers(query = '') {
  return protectedServerApiRequest<UserListResponse>(`/admin/users${query ? `?${query}` : ''}`);
}

export async function getUserProfile() {
  return protectedServerApiRequest<UserSummary>('/users/me');
}

export async function getSessions() {
  return protectedServerApiRequest<SessionListResponse>('/auth/sessions');
}
