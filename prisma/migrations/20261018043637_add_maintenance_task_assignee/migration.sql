-- AlterTable
ALTER TABLE "maintenance_tasks" ADD COLUMN     "assigned_to" UUID;

-- CreateIndex
CREATE INDEX "maintenance_tasks_assigned_to_idx" ON "maintenance_tasks"("assigned_to");

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
