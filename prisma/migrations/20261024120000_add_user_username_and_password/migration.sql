-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
