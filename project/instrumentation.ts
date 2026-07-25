export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const globalForCron = globalThis as unknown as { cronRegistered?: boolean }
  if (globalForCron.cronRegistered) return
  globalForCron.cronRegistered = true

  const cron = await import("node-cron")
  const { runScheduleReminders } = await import("@/lib/cron/schedule-reminders")
  const { runMorningBriefing } = await import("@/lib/cron/morning-briefing")
  const { runEveningEvaluation } = await import("@/lib/cron/evening-evaluation")
  const { runRecurringScheduleTopUp } = await import("@/lib/cron/recurring-schedule-topup")

  // Tahap 5: cek jadwal yang mendekati waktu setiap 5 menit, kirim reminder WhatsApp.
  cron.schedule(
    "*/5 * * * *",
    () => {
      runScheduleReminders().catch((e) => console.error("[cron] schedule-reminders gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  // Tahap 4: briefing pagi jam 07:00 WIB.
  cron.schedule(
    "0 7 * * *",
    () => {
      runMorningBriefing().catch((e) => console.error("[cron] morning-briefing gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  // Tahap 4: evaluasi malam jam 20:00 WIB.
  cron.schedule(
    "0 20 * * *",
    () => {
      runEveningEvaluation().catch((e) => console.error("[cron] evening-evaluation gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  // Top-up jadwal rutin/berulang setiap Senin dini hari, supaya horizon-nya tidak pernah habis.
  cron.schedule(
    "0 1 * * 1",
    () => {
      runRecurringScheduleTopUp().catch((e) => console.error("[cron] recurring-schedule-topup gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  console.log(
    "[cron] Terdaftar: reminder jadwal (5 menit), briefing pagi (07:00), evaluasi malam (20:00), top-up jadwal rutin (Senin 01:00) WIB"
  )
}
