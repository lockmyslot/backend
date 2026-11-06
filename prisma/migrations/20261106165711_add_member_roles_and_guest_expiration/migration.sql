-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GroupRole" ADD VALUE 'MODERATOR';
ALTER TYPE "GroupRole" ADD VALUE 'GUEST';

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "group_members_role_expires_at_idx" ON "group_members"("role", "expires_at");
