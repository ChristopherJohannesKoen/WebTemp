import { initContract } from '@ts-rest/core';
import {
  ApiErrorSchema,
  AuthPayloadSchema,
  AuthResponseSchema,
  CsrfResponseSchema,
  ForgotPasswordPayloadSchema,
  ForgotPasswordResponseSchema,
  HealthResponseSchema,
  OkResponseSchema,
  ProjectIdParamsSchema,
  ProjectListQuerySchema,
  ProjectListResponseSchema,
  ProjectSchema,
  ProjectUpsertPayloadSchema,
  ResetPasswordPayloadSchema,
  RevokeSessionResponseSchema,
  SessionIdParamsSchema,
  SessionListResponseSchema,
  SignupPayloadSchema,
  UpdateProfilePayloadSchema,
  UpdateRolePayloadSchema,
  UserIdParamsSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserSummarySchema
} from '@packages/shared';
import { z } from 'zod';

const c = initContract();

const csrfHeaderSchema = z.object({
  'x-csrf-token': z.string().min(1)
});

const idempotencyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1)
});

const projectUpdatePayloadSchema = ProjectUpsertPayloadSchema.partial();

const commonResponses = c.responses({
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  429: ApiErrorSchema,
  500: ApiErrorSchema,
  503: ApiErrorSchema
});

export const apiContract = c.router(
  {
    health: c.router({
      status: {
        method: 'GET',
        path: '/health',
        responses: {
          200: HealthResponseSchema
        },
        summary: 'API and database health status'
      }
    }),
    auth: c.router(
      {
        signup: {
          method: 'POST',
          path: '/signup',
          body: SignupPayloadSchema,
          headers: idempotencyHeaderSchema,
          responses: {
            201: AuthResponseSchema
          }
        },
        login: {
          method: 'POST',
          path: '/login',
          body: AuthPayloadSchema,
          responses: {
            200: AuthResponseSchema
          }
        },
        logout: {
          method: 'POST',
          path: '/logout',
          body: c.noBody(),
          headers: csrfHeaderSchema,
          responses: {
            200: OkResponseSchema
          }
        },
        csrf: {
          method: 'GET',
          path: '/csrf',
          responses: {
            200: CsrfResponseSchema
          }
        },
        me: {
          method: 'GET',
          path: '/me',
          responses: {
            200: AuthResponseSchema
          }
        },
        listSessions: {
          method: 'GET',
          path: '/sessions',
          responses: {
            200: SessionListResponseSchema
          }
        },
        revokeSession: {
          method: 'DELETE',
          path: '/sessions/:sessionId',
          pathParams: SessionIdParamsSchema,
          headers: csrfHeaderSchema,
          responses: {
            200: RevokeSessionResponseSchema
          }
        },
        forgotPassword: {
          method: 'POST',
          path: '/password/forgot',
          body: ForgotPasswordPayloadSchema,
          responses: {
            200: ForgotPasswordResponseSchema
          }
        },
        resetPassword: {
          method: 'POST',
          path: '/password/reset',
          body: ResetPasswordPayloadSchema,
          headers: idempotencyHeaderSchema,
          responses: {
            200: AuthResponseSchema
          }
        },
        logoutAll: {
          method: 'POST',
          path: '/logout-all',
          body: c.noBody(),
          headers: csrfHeaderSchema,
          responses: {
            200: OkResponseSchema
          }
        }
      },
      {
        pathPrefix: '/auth'
      }
    ),
    users: c.router(
      {
        me: {
          method: 'GET',
          path: '/me',
          responses: {
            200: UserSummarySchema
          }
        },
        updateMe: {
          method: 'PATCH',
          path: '/me',
          body: UpdateProfilePayloadSchema,
          headers: csrfHeaderSchema,
          responses: {
            200: UserSummarySchema
          }
        }
      },
      {
        pathPrefix: '/users'
      }
    ),
    admin: c.router(
      {
        listUsers: {
          method: 'GET',
          path: '/users',
          query: UserListQuerySchema,
          responses: {
            200: UserListResponseSchema
          }
        },
        updateUserRole: {
          method: 'PATCH',
          path: '/users/:id/role',
          pathParams: UserIdParamsSchema,
          body: UpdateRolePayloadSchema,
          headers: csrfHeaderSchema,
          responses: {
            200: UserSummarySchema
          }
        }
      },
      {
        pathPrefix: '/admin'
      }
    ),
    projects: c.router(
      {
        list: {
          method: 'GET',
          path: '/',
          query: ProjectListQuerySchema,
          responses: {
            200: ProjectListResponseSchema
          }
        },
        exportCsv: {
          method: 'GET',
          path: '/export.csv',
          query: ProjectListQuerySchema,
          responses: {
            200: c.otherResponse({
              contentType: 'text/csv',
              body: z.string()
            })
          }
        },
        get: {
          method: 'GET',
          path: '/:id',
          pathParams: ProjectIdParamsSchema,
          responses: {
            200: ProjectSchema
          }
        },
        create: {
          method: 'POST',
          path: '/',
          body: ProjectUpsertPayloadSchema,
          headers: csrfHeaderSchema.merge(idempotencyHeaderSchema),
          responses: {
            201: ProjectSchema
          }
        },
        update: {
          method: 'PATCH',
          path: '/:id',
          pathParams: ProjectIdParamsSchema,
          body: projectUpdatePayloadSchema,
          headers: csrfHeaderSchema,
          responses: {
            200: ProjectSchema
          }
        },
        delete: {
          method: 'DELETE',
          path: '/:id',
          pathParams: ProjectIdParamsSchema,
          headers: csrfHeaderSchema,
          responses: {
            200: OkResponseSchema
          }
        }
      },
      {
        pathPrefix: '/projects'
      }
    )
  },
  {
    strictStatusCodes: true,
    commonResponses
  }
);

export type ApiContract = typeof apiContract;
