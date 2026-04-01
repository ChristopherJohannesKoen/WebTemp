import { z } from 'zod';

export const RoleSchema = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof RoleSchema>;

export const ProjectStatusSchema = z.enum(['active', 'paused', 'completed']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const AuditActionSchema = z.enum([
  'auth.signup',
  'auth.login',
  'auth.logout',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'user.profile_updated',
  'user.role_updated',
  'project.created',
  'project.updated',
  'project.archived',
  'project.unarchived',
  'project.deleted'
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const ApiValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string()
});

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.array(ApiValidationErrorSchema).default([])
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

export const ForgotPasswordResponseSchema = z.object({
  message: z.string(),
  resetToken: z.string().optional(),
  resetUrl: z.string().url().optional()
});
export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

export const UpdateProfilePayloadSchema = z.object({
  name: z.string().trim().min(2).max(80)
});
export type UpdateProfilePayload = z.infer<typeof UpdateProfilePayloadSchema>;

export const UserSummarySchema = SessionUserSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string()
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const UpdateRolePayloadSchema = z.object({
  role: RoleSchema
});
export type UpdateRolePayload = z.infer<typeof UpdateRolePayloadSchema>;

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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10)
});
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

export const PaginatedListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0)
  });

export const ProjectListResponseSchema = PaginatedListSchema(ProjectSchema);
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const UserListResponseSchema = PaginatedListSchema(UserSummarySchema);
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
