CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "IdempotencyStatus" AS ENUM ('pending', 'completed');

ALTER TABLE "Session"
  ADD COLUMN "csrfTokenHash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Session"
  ALTER COLUMN "csrfTokenHash" DROP DEFAULT;

CREATE TABLE "IdempotencyRequest" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'pending',
  "responseStatusCode" INTEGER,
  "responseBody" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRequest_scope_idempotencyKey_method_path_key"
  ON "IdempotencyRequest"("scope", "idempotencyKey", "method", "path");
CREATE INDEX "IdempotencyRequest_expiresAt_idx" ON "IdempotencyRequest"("expiresAt");
CREATE INDEX "Session_lastRotatedAt_idx" ON "Session"("lastRotatedAt");
CREATE INDEX "Project_updatedAt_id_idx" ON "Project"("updatedAt", "id");
CREATE INDEX "Project_name_trgm_idx" ON "Project" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Project_description_trgm_idx"
  ON "Project" USING gin (COALESCE("description", '') gin_trgm_ops);
