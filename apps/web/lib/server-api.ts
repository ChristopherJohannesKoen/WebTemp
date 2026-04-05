import { apiContract } from '@packages/contracts';
import type {
  AuthResponse,
  Project,
  ProjectListQuery,
  ProjectListResponse,
  SessionListResponse,
  UserListQuery,
  UserListResponse,
  UserSummary
} from '@packages/shared';
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiRequestError, toApiError, unwrapContractResponse } from './api-error';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'ultimate_template_session';

const serverClient = initClient(apiContract, {
  baseUrl: `${apiOrigin}/api`,
  validateResponse: true,
  throwOnUnknownStatus: true,
  api: async (args) => {
    const headers = { ...args.headers };
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionCookieName);

    if (sessionCookie && !headers.cookie) {
      headers.cookie = `${sessionCookie.name}=${sessionCookie.value}`;
    }

    return tsRestFetchApi({
      ...args,
      headers,
      fetchOptions: {
        ...args.fetchOptions,
        cache: 'no-store'
      }
    });
  }
});

async function executeServerRequest<T>(
  operation: () => Promise<{ status: number; body: unknown; headers: Headers }>,
  expectedStatuses: readonly number[]
) {
  noStore();

  try {
    const response = await operation();
    return unwrapContractResponse<T>(response, expectedStatuses);
  } catch (error) {
    throw toApiError(error);
  }
}

async function protectedServerRequest<T>(
  operation: () => Promise<{ status: number; body: unknown; headers: Headers }>,
  expectedStatuses: readonly number[]
) {
  try {
    return await executeServerRequest<T>(operation, expectedStatuses);
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      redirect('/login');
    }

    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const response = await executeServerRequest<AuthResponse>(() => serverClient.auth.me(), [200]);
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

export function getProjects(query: Partial<ProjectListQuery> = {}) {
  return protectedServerRequest<ProjectListResponse>(
    () => serverClient.projects.list({ query }),
    [200]
  );
}

export function getProject(projectId: string) {
  return protectedServerRequest<Project>(
    () =>
      serverClient.projects.get({
        params: { id: projectId }
      }),
    [200]
  );
}

export function getUsers(query: Partial<UserListQuery> = {}) {
  return protectedServerRequest<UserListResponse>(
    () => serverClient.admin.listUsers({ query }),
    [200]
  );
}

export function getUserProfile() {
  return protectedServerRequest<UserSummary>(() => serverClient.users.me(), [200]);
}

export function getSessions() {
  return protectedServerRequest<SessionListResponse>(() => serverClient.auth.listSessions(), [200]);
}
