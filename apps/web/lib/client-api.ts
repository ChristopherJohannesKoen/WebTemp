'use client';

import { apiContract } from '@packages/contracts';
import type {
  AuthPayload,
  AuthResponse,
  BreakGlassLoginPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  OkResponse,
  Project,
  ProjectUpsertPayload,
  ResetPasswordPayload,
  RevokeSessionResponse,
  Role,
  StepUpResponse,
  UpdateProfilePayload,
  UserSummary
} from '@packages/shared';
import { ApiErrorSchema } from '@packages/shared';
import { initClient } from '@ts-rest/core';
import { toApiError, unwrapContractResponse } from './api-error';

const unsafeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const browserClient = initClient(apiContract, {
  baseUrl: '/api',
  credentials: 'same-origin',
  validateResponse: true,
  throwOnUnknownStatus: true
});

let csrfTokenCache: string | undefined;
let csrfTokenPromise: Promise<string> | undefined;
type MutationHeaders = {
  'idempotency-key'?: string;
  'x-csrf-token'?: string;
};

function clearCsrfToken() {
  csrfTokenCache = undefined;
  csrfTokenPromise = undefined;
}

function createIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

async function withApiErrors<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    throw toApiError(error);
  }
}

async function fetchCsrfToken(forceRefresh = false) {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfTokenPromise || forceRefresh) {
    csrfTokenPromise = withApiErrors(async () => {
      const response = await browserClient.auth.csrf();
      const payload = unwrapContractResponse<{ csrfToken: string }>(response, [200]);
      csrfTokenCache = payload.csrfToken;
      return payload.csrfToken;
    }).finally(() => {
      csrfTokenPromise = undefined;
    });
  }

  return csrfTokenPromise;
}

async function executeMutation<T>({
  call,
  expectedStatuses,
  idempotent = false,
  method,
  requireCsrf,
  clearCsrfAfter = false
}: {
  call: (headers: MutationHeaders) => Promise<{ status: number; body: unknown; headers: Headers }>;
  expectedStatuses: readonly number[];
  idempotent?: boolean;
  method: string;
  requireCsrf?: boolean;
  clearCsrfAfter?: boolean;
}) {
  return withApiErrors(async () => {
    const shouldSendCsrf = requireCsrf ?? unsafeMethods.has(method);
    const idempotencyKey = idempotent ? createIdempotencyKey() : undefined;

    const run = async (forceCsrfRefresh = false) => {
      const headers: MutationHeaders = {};

      if (idempotencyKey) {
        headers['idempotency-key'] = idempotencyKey;
      }

      if (shouldSendCsrf) {
        headers['x-csrf-token'] = await fetchCsrfToken(forceCsrfRefresh);
      }

      return call(headers);
    };

    let response = await run(false);
    const parsedError = ApiErrorSchema.safeParse(response.body);

    if (
      shouldSendCsrf &&
      response.status === 403 &&
      parsedError.success &&
      parsedError.data.code === 'csrf_invalid'
    ) {
      clearCsrfToken();
      response = await run(true);
    }

    const payload = unwrapContractResponse<T>(response, expectedStatuses);

    if (clearCsrfAfter) {
      clearCsrfToken();
    }

    return payload;
  });
}

export function signIn(body: AuthPayload) {
  return executeMutation<AuthResponse>({
    method: 'POST',
    requireCsrf: false,
    clearCsrfAfter: true,
    expectedStatuses: [200],
    call: () => browserClient.auth.login({ body })
  });
}

export function breakGlassSignIn(body: BreakGlassLoginPayload) {
  return executeMutation<AuthResponse>({
    method: 'POST',
    requireCsrf: false,
    clearCsrfAfter: true,
    expectedStatuses: [200],
    call: () => browserClient.auth.breakGlassLogin({ body })
  });
}

export function signUp(body: { name: string; email: string; password: string }) {
  return executeMutation<AuthResponse>({
    method: 'POST',
    requireCsrf: false,
    clearCsrfAfter: true,
    expectedStatuses: [201],
    idempotent: true,
    call: (headers) =>
      browserClient.auth.signup({
        body,
        headers: {
          'idempotency-key': headers['idempotency-key']!
        }
      })
  });
}

export function requestPasswordReset(body: ForgotPasswordPayload) {
  return executeMutation<ForgotPasswordResponse>({
    method: 'POST',
    requireCsrf: false,
    expectedStatuses: [200],
    call: () => browserClient.auth.forgotPassword({ body })
  });
}

export function resetPassword(body: ResetPasswordPayload) {
  return executeMutation<AuthResponse>({
    method: 'POST',
    requireCsrf: false,
    clearCsrfAfter: true,
    expectedStatuses: [200],
    idempotent: true,
    call: (headers) =>
      browserClient.auth.resetPassword({
        body,
        headers: {
          'idempotency-key': headers['idempotency-key']!
        }
      })
  });
}

export function logout() {
  return executeMutation<OkResponse>({
    method: 'POST',
    clearCsrfAfter: true,
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.auth.logout({
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function logoutAll() {
  return executeMutation<OkResponse>({
    method: 'POST',
    clearCsrfAfter: true,
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.auth.logoutAll({
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function completeStepUp(password: string) {
  return executeMutation<StepUpResponse>({
    method: 'POST',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.auth.stepUp({
        body: { password },
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function revokeSession(sessionId: string) {
  return executeMutation<RevokeSessionResponse>({
    method: 'DELETE',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.auth.revokeSession({
        params: { sessionId },
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function updateProfile(body: UpdateProfilePayload) {
  return executeMutation<UserSummary>({
    method: 'PATCH',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.users.updateMe({
        body,
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function createProject(body: ProjectUpsertPayload) {
  return executeMutation<Project>({
    method: 'POST',
    expectedStatuses: [201],
    idempotent: true,
    call: (headers) =>
      browserClient.projects.create({
        body,
        headers: {
          'idempotency-key': headers['idempotency-key']!,
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function updateProject(projectId: string, body: Partial<ProjectUpsertPayload>) {
  return executeMutation<Project>({
    method: 'PATCH',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.projects.update({
        params: { id: projectId },
        body,
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function deleteProject(projectId: string) {
  return executeMutation<OkResponse>({
    method: 'DELETE',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.projects.delete({
        params: { id: projectId },
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}

export function updateUserRole(userId: string, role: Role) {
  return executeMutation<UserSummary>({
    method: 'PATCH',
    expectedStatuses: [200],
    call: (headers) =>
      browserClient.admin.updateUserRole({
        params: { id: userId },
        body: { role },
        headers: {
          'x-csrf-token': headers['x-csrf-token']!
        }
      })
  });
}
