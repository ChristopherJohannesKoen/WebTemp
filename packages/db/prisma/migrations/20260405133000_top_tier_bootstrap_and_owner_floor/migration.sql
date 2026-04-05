CREATE TABLE "BootstrapState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "bootstrapOwnerId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BootstrapState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BootstrapState_singleton_check" CHECK ("id" = 1)
);

CREATE UNIQUE INDEX "BootstrapState_bootstrapOwnerId_key" ON "BootstrapState"("bootstrapOwnerId");

ALTER TABLE "BootstrapState"
  ADD CONSTRAINT "BootstrapState_bootstrapOwnerId_fkey"
  FOREIGN KEY ("bootstrapOwnerId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
