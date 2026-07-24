-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assistant_instructions" TEXT,
ADD COLUMN     "notify_agenda" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_daily_report" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_morning_briefing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_priority_alert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'Direktur';
