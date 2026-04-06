-- CreateEnum
CREATE TYPE "IdentityProviderType" AS ENUM ('oidc', 'saml');

-- CreateEnum
CREATE TYPE "IdentityProviderStatus" AS ENUM ('staged', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "SessionAuthMethod" AS ENUM ('local', 'oidc', 'saml', 'break_glass');

-- CreateEnum
CREATE TYPE "SessionAuthReason" AS ENUM (
  'local_login',
  'oidc_login',
  'saml_login',
  'password_reset',
  'break_glass'
);

-- CreateEnum
CREATE TYPE "AuditEventCategory" AS ENUM (
  'application',
  'authentication',
  'provisioning',
  'authorization',
  'configuration',
  'export',
  'security'
);

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('success', 'denied', 'failure');

-- CreateEnum
CREATE TYPE "ProvisioningCursorType" AS ENUM ('scim_users', 'scim_groups');

-- CreateEnum
CREATE TYPE "AccessPolicyEventType" AS ENUM (
  'jit_provision',
  'scim_provision',
  'group_mapping_applied',
  'group_mapping_denied',
  'break_glass_login',
  'step_up_completed',
  'provider_configuration_changed'
);

-- CreateEnum
CREATE TYPE "AccessPolicyOutcome" AS ENUM ('success', 'denied', 'failure');

-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "provisionedBy" "IdentityProviderType";

-- AlterTable
ALTER TABLE "Session"
  ADD COLUMN "authMethod" "SessionAuthMethod" NOT NULL DEFAULT 'local',
  ADD COLUMN "authReason" "SessionAuthReason" NOT NULL DEFAULT 'local_login',
  ADD COLUMN "identityProviderId" TEXT,
  ADD COLUMN "externalSubject" TEXT,
  ADD COLUMN "stepUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN "eventCategory" "AuditEventCategory" NOT NULL DEFAULT 'application',
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'success',
  ADD COLUMN "authMechanism" "SessionAuthMethod",
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "entryHash" TEXT;

UPDATE "AuditLog"
SET "entryHash" = md5("id" || ':' || COALESCE("action", '') || ':' || COALESCE("targetType", '') || ':' || COALESCE("targetId", ''))
WHERE "entryHash" IS NULL;

ALTER TABLE "AuditLog"
  ALTER COLUMN "entryHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "IdentityProviderConfig" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "type" "IdentityProviderType" NOT NULL,
  "status" "IdentityProviderStatus" NOT NULL DEFAULT 'staged',
  "issuer" TEXT,
  "authorizationEndpoint" TEXT,
  "tokenEndpoint" TEXT,
  "jwksUri" TEXT,
  "clientId" TEXT,
  "clientSecretRef" TEXT,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "samlSsoUrl" TEXT,
  "samlEntityId" TEXT,
  "samlCertificatePem" TEXT,
  "verifiedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "groupClaim" TEXT,
  "emailClaim" TEXT,
  "subjectClaim" TEXT,
  "scimBearerTokenRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalSubject" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAuthenticatedAt" TIMESTAMP(3),
  CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroup" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userGroupId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRoleMapping" (
  "id" TEXT NOT NULL,
  "userGroupId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupRoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningCursor" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "cursorType" "ProvisioningCursorType" NOT NULL,
  "cursorValue" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProvisioningCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicyEvent" (
  "id" TEXT NOT NULL,
  "providerId" TEXT,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "event" "AccessPolicyEventType" NOT NULL,
  "outcome" "AccessPolicyOutcome" NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessPolicyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_entryHash_key" ON "AuditLog"("entryHash");

-- CreateIndex
CREATE INDEX "AuditLog_eventCategory_createdAt_idx" ON "AuditLog"("eventCategory", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_legalHold_createdAt_idx" ON "AuditLog"("legalHold", "createdAt");

-- CreateIndex
CREATE INDEX "Session_identityProviderId_idx" ON "Session"("identityProviderId");

-- CreateIndex
CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityProviderConfig_slug_key" ON "IdentityProviderConfig"("slug");

-- CreateIndex
CREATE INDEX "IdentityProviderConfig_status_type_idx" ON "IdentityProviderConfig"("status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_providerId_externalSubject_key" ON "UserIdentity"("providerId", "externalSubject");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_providerId_externalId_key" ON "UserGroup"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "UserGroup_name_idx" ON "UserGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMembership_userId_userGroupId_key" ON "UserGroupMembership"("userId", "userGroupId");

-- CreateIndex
CREATE INDEX "UserGroupMembership_userGroupId_idx" ON "UserGroupMembership"("userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoleMapping_userGroupId_key" ON "GroupRoleMapping"("userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningCursor_providerId_cursorType_key" ON "ProvisioningCursor"("providerId", "cursorType");

-- CreateIndex
CREATE INDEX "AccessPolicyEvent_providerId_createdAt_idx" ON "AccessPolicyEvent"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessPolicyEvent_targetUserId_createdAt_idx" ON "AccessPolicyEvent"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_identityProviderId_fkey"
  FOREIGN KEY ("identityProviderId")
  REFERENCES "IdentityProviderConfig"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity"
  ADD CONSTRAINT "UserIdentity_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity"
  ADD CONSTRAINT "UserIdentity_providerId_fkey"
  FOREIGN KEY ("providerId")
  REFERENCES "IdentityProviderConfig"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroup"
  ADD CONSTRAINT "UserGroup_providerId_fkey"
  FOREIGN KEY ("providerId")
  REFERENCES "IdentityProviderConfig"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupMembership"
  ADD CONSTRAINT "UserGroupMembership_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupMembership"
  ADD CONSTRAINT "UserGroupMembership_userGroupId_fkey"
  FOREIGN KEY ("userGroupId")
  REFERENCES "UserGroup"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleMapping"
  ADD CONSTRAINT "GroupRoleMapping_userGroupId_fkey"
  FOREIGN KEY ("userGroupId")
  REFERENCES "UserGroup"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningCursor"
  ADD CONSTRAINT "ProvisioningCursor_providerId_fkey"
  FOREIGN KEY ("providerId")
  REFERENCES "IdentityProviderConfig"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyEvent"
  ADD CONSTRAINT "AccessPolicyEvent_providerId_fkey"
  FOREIGN KEY ("providerId")
  REFERENCES "IdentityProviderConfig"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyEvent"
  ADD CONSTRAINT "AccessPolicyEvent_actorId_fkey"
  FOREIGN KEY ("actorId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyEvent"
  ADD CONSTRAINT "AccessPolicyEvent_targetUserId_fkey"
  FOREIGN KEY ("targetUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
