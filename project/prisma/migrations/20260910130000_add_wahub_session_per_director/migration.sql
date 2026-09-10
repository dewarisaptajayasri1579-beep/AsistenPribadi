-- AlterTable
ALTER TABLE "users" ADD COLUMN     "wahub_session_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_wahub_session_id_key" ON "users"("wahub_session_id");

