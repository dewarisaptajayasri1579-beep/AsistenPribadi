export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const globalForCron = globalThis as unknown as { cronRegistered?: boolean }
  if (globalForCron.cronRegistered) return
  globalForCron.cronRegistered = true

  const cron = await import("node-cron")
  const { runScheduleReminders } = await import("@/lib/cron/schedule-reminders")
  const { runScheduleCheckins } = await import("@/lib/cron/schedule-checkins")
  const { runMorningBriefing } = await import("@/lib/cron/morning-briefing")
  const { runEveningEvaluation } = await import("@/lib/cron/evening-evaluation")
  const { runRecurringScheduleTopUp } = await import("@/lib/cron/recurring-schedule-topup")
  const { runStockWatchCheck } = await import("@/lib/cron/stock-watch")
  const { registerWahubWebhook } = await import("@/lib/wahub")

  // Daftarkan ulang webhook WAHUB pakai env var yang aktif sekarang, tiap kali server start —
  // supaya kalau WAHUB_API_KEY/WAHUB_WEBHOOK_SECRET/APP_BASE_URL berubah (redeploy/rotate key),
  // webhook otomatis ke-sync ulang tanpa perlu didaftarkan manual lewat API.
  registerWahubWebhook().catch((e) => console.error("[wahub] registrasi webhook saat startup gagal:", e))

  // Tahap 5: cek jadwal yang mendekati waktu setiap 5 menit, kirim reminder WhatsApp.
  cron.schedule(
    "*/5 * * * *",
    () => {
      runScheduleReminders().catch((e) => console.error("[cron] schedule-reminders gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  // Cek jadwal yang sudah lewat >=30 menit & belum di-checkin, kirim WA nanya sudah selesai atau belum.
  cron.schedule(
    "*/5 * * * *",
    () => {
      runScheduleCheckins().catch((e) => console.error("[cron] schedule-checkins gagal:", e))
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

  // Cek harga saham yang dipantau tiap 15 menit pas jam bursa (Senin-Jumat 09:00-16:00 WIB).
  cron.schedule(
    "*/15 9-16 * * 1-5",
    () => {
      runStockWatchCheck().catch((e) => console.error("[cron] stock-watch gagal:", e))
    },
    { timezone: "Asia/Jakarta" }
  )

  console.log(
    "[cron] Terdaftar: reminder jadwal (5 menit), checkin jadwal selesai (5 menit), briefing pagi (07:00), evaluasi malam (20:00), top-up jadwal rutin (Senin 01:00), cek harga saham (15 menit, jam bursa) WIB"
  )
}
