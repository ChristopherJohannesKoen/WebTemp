import { z } from 'zod';

export const RoleSchema = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof RoleSchema>;

export const IdentityProviderTypeSchema = z.enum(['oidc', 'saml']);
export type IdentityProviderType = z.infer<typeof IdentityProviderTypeSchema>;

export const IdentityProviderStatusSchema = z.enum(['staged', 'active', 'disabled']);
export type IdentityProviderStatus = z.infer<typeof IdentityProviderStatusSchema>;

export const SessionAuthMethodSchema = z.enum(['local', 'oidc', 'saml', 'break_glass']);
export type SessionAuthMethod = z.infer<typeof SessionAuthMethodSchema>;

export const SessionAuthReasonSchema = z.enum([
  'local_login',
  'oidc_login',
  'saml_login',
  'password_reset',
  'break_glass'
]);
export type SessionAuthReason = z.infer<typeof SessionAuthReasonSchema>;

export const AuditEventCategorySchema = z.enum([
  'application',
  'authentication',
  'provisioning',
  'authorization',
  'configuration',
  'export',
  'security'
]);
export type AuditEventCategory = z.infer<typeof AuditEventCategorySchema>;

export const AuditOutcomeSchema = z.enum(['success', 'denied', 'failure']);
export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

export const ProjectStatusSchema = z.enum(['active', 'paused', 'completed']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const AuditActionSchema = z.enum([
  'auth.signup',
  'auth.login',
  'auth.break_glass_login',
  'auth.step_up_completed',
  'auth.sso_login',
  'auth.sso_provider_started',
  'auth.sso_provider_callback',
  'auth.logout',
  'auth.session_revoked',
  'auth.logout_all',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'authz.denied',
  'identity.provider_upserted',
  'identity.group_mapping_applied',
  'identity.scim_user_provisioned',
  'identity.scim_group_provisioned',
  'governance.retention_cleanup',
  'user.profile_updated',
  'user.role_updated',
  'project.created',
  'project.updated',
  'project.archived',
  'project.unarchived',
  'project.deleted'
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const IdentityProviderSummarySchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  type: IdentityProviderTypeSchema,
  status: IdentityProviderStatusSchema.default('active')
});
export type IdentityProviderSummary = z.infer<typeof IdentityProviderSummarySchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  disabledAt: z.string().nullable().optional(),
  provisionedBy: IdentityProviderTypeSchema.nullable().optional(),
  identityProvider: IdentityProviderSummarySchema.nullable().optional()
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const ApiValidationErrorSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string()
});

export const ApiErrorCodeSchema = z.string();
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  code: ApiErrorCodeSchema.optional(),
  errors: z.array(ApiValidationErrorSchema).default([]),
  requestId: z.string().optional()
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  timestamp: z.string(),
  database: z.literal('up')
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const AuthPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const SignupPayloadSchema = AuthPayloadSchema.extend({
  name: z.string().trim().min(2).max(80)
});
export type SignupPayload = z.infer<typeof SignupPayloadSchema>;

export const ForgotPasswordPayloadSchema = z.object({
  email: z.string().email()
});
export type ForgotPasswordPayload = z.infer<typeof ForgotPasswordPayloadSchema>;

export const ResetPasswordPayloadSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});
export type ResetPasswordPayload = z.infer<typeof ResetPasswordPayloadSchema>;

export const AuthResponseSchema = z.object({
  user: SessionUserSchema
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SsoProvidersResponseSchema = z.object({
  providers: z.array(IdentityProviderSummarySchema),
  localAuthEnabled: z.boolean(),
  breakGlassEnabled: z.boolean()
});
export type SsoProvidersResponse = z.infer<typeof SsoProvidersResponseSchema>;

export const OkResponseSchema = z.object({
  ok: z.literal(true)
});
export type OkResponse = z.infer<typeof OkResponseSchema>;

export const CsrfResponseSchema = z.object({
  csrfToken: z.string().min(32)
});
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;

export const ForgotPasswordResponseSchema = z.object({
  message: z.string(),
  resetToken: z.string().optional(),
  resetUrl: z.string().url().optional()
});
export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

export const BreakGlassLoginPayloadSchema = AuthPayloadSchema;
export type BreakGlassLoginPayload = z.infer<typeof BreakGlassLoginPayloadSchema>;

export const StepUpPayloadSchema = z.object({
  password: z.string().min(8)
});
export type StepUpPayload = z.infer<typeof StepUpPayloadSchema>;

export const StepUpResponseSchema = z.object({
  ok: z.literal(true),
  stepUpExpiresAt: z.string()
});
export type StepUpResponse = z.infer<typeof StepUpResponseSchema>;

export const UpdateProfilePayloadSchema = z.object({
  name: z.string().trim().min(2).max(80)
});
export type UpdateProfilePayload = z.infer<typeof UpdateProfilePayloadSchema>;

export const ProjectIdParamsSchema = z.object({
  id: z.string()
});
export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

export const SessionIdParamsSchema = z.object({
  sessionId: z.string()
});
export type SessionIdParams = z.infer<typeof SessionIdParamsSchema>;

export const UserIdParamsSchema = z.object({
  id: z.string()
});
export type UserIdParams = z.infer<typeof UserIdParamsSchema>;

export const UserSummarySchema = SessionUserSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string()
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const UpdateRolePayloadSchema = z.object({
  role: RoleSchema
});
export type UpdateRolePayload = z.infer<typeof UpdateRolePayloadSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  authMethod: SessionAuthMethodSchema,
  authReason: SessionAuthReasonSchema,
  identityProvider: IdentityProviderSummarySchema.nullable(),
  stepUpAt: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean()
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionListResponseSchema = z.object({
  items: z.array(SessionSummarySchema)
});
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

export const RevokeSessionResponseSchema = OkResponseSchema.extend({
  revokedCurrent: z.boolean()
});
export type RevokeSessionResponse = z.infer<typeof RevokeSessionResponseSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creator: SessionUserSchema.pick({
    id: true,
    email: true,
    name: true,
    role: true
  })
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectUpsertPayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  status: ProjectStatusSchema.default('active'),
  isArchived: z.boolean().default(false)
});
export type ProjectUpsertPayload = z.infer<typeof ProjectUpsertPayloadSchema>;

export const ProjectListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: ProjectStatusSchema.optional(),
  includeArchived: z.boolean().optional().default(false),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

export const PaginatedListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0)
  });

export const CursorListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean()
  });

export const ProjectListResponseSchema = CursorListSchema(ProjectSchema);
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const UserListResponseSchema = PaginatedListSchema(UserSummarySchema);
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const ScimSchemasSchema = z
  .array(z.string())
  .default(['urn:ietf:params:scim:schemas:core:2.0:User']);
export type ScimSchemas = z.infer<typeof ScimSchemasSchema>;

export const ScimEmailSchema = z.object({
  value: z.string().email(),
  primary: z.boolean().optional()
});
export type ScimEmail = z.infer<typeof ScimEmailSchema>;

export const ScimNameSchema = z.object({
  givenName: z.string().optional(),
  familyName: z.string().optional()
});
export type ScimName = z.infer<typeof ScimNameSchema>;

export const ScimGroupRefSchema = z.object({
  value: z.string(),
  display: z.string().optional()
});
export type ScimGroupRef = z.infer<typeof ScimGroupRefSchema>;

export const ScimUserSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:schemas:core:2.0:User']),
  id: z.string().optional(),
  externalId: z.string().optional(),
  userName: z.string().email(),
  active: z.boolean().default(true),
  name: ScimNameSchema.optional(),
  displayName: z.string().optional(),
  emails: z.array(ScimEmailSchema).default([]),
  groups: z.array(ScimGroupRefSchema).default([])
});
export type ScimUser = z.infer<typeof ScimUserSchema>;

export const ScimGroupSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:schemas:core:2.0:Group']),
  id: z.string().optional(),
  externalId: z.string(),
  displayName: z.string(),
  members: z.array(ScimGroupRefSchema).default([])
});
export type ScimGroup = z.infer<typeof ScimGroupSchema>;

export const ScimListResponseSchema = <T extends z.ZodTypeAny>(resourceSchema: T) =>
  z.object({
    totalResults: z.number().int().min(0),
    startIndex: z.number().int().min(1).default(1),
    itemsPerPage: z.number().int().min(0),
    Resources: z.array(resourceSchema)
  });

export const ScimUserListResponseSchema = ScimListResponseSchema(ScimUserSchema);
export type ScimUserListResponse = z.infer<typeof ScimUserListResponseSchema>;

export const ScimGroupListResponseSchema = ScimListResponseSchema(ScimGroupSchema);
export type ScimGroupListResponse = z.infer<typeof ScimGroupListResponseSchema>;
