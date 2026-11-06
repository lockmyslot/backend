-- AlterTable
ALTER TABLE "group_invites" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "role" "GroupRole" NOT NULL DEFAULT 'GUEST';
