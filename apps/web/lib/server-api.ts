import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  AuthResponse,
  Project,
  ProjectListResponse,
  SessionListResponse,
  UserListResponse,
  UserSummary
} from '@packages/shared';
import { parseApiResponse } from './api-error';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

function getFetchOptions(path: string, init?: RequestInit) {
  const method = init?.method?.toUpperCase() ?? 'GET';

  if (method !== 'GET') {
    return { cache: 'no-store' as const };
  }

  if (
    path.startsWith('/auth/me') ||
    path.startsWith('/auth/sessions') ||
    path.startsWith('/users/me')
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

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (cookieStore.toString()) {
    headers.set('cookie', cookieStore.toString());
  }

  const response = await fetch(`${apiOrigin}/api${path}`, {
    ...init,
    ...getFetchOptions(path, init),
    headers
  });

  return parseApiResponse<T>(response);
}

export async function getCurrentUser() {
  try {
    const response = await serverApiRequest<AuthResponse>('/auth/me');
    return response.user;
  } catch {
    return undefined;
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
  return serverApiRequest<ProjectListResponse>(`/projects${query ? `?${query}` : ''}`);
}

export async function getProject(projectId: string) {
  return serverApiRequest<Project>(`/projects/${projectId}`);
}

export async function getUsers(query = '') {
  return serverApiRequest<UserListResponse>(`/admin/users${query ? `?${query}` : ''}`);
}

export async function getUserProfile() {
  return serverApiRequest<UserSummary>('/users/me');
}

export async function getSessions() {
  return serverApiRequest<SessionListResponse>('/auth/sessions');
}
