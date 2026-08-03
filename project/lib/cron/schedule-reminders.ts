import { formatJakartaTime } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push"
import { sendWhatsappMessage } from "@/lib/wahub"

const REMINDER_WINDOW_MINUTES = 15

/** Cari jadwal yang mulai dalam N menit ke depan & belum diingatkan, lalu kirim WA. */
export async function runScheduleReminders() {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000)

  const upcoming = await prisma.schedule.findMany({
    where: {
      status: { not: "cancelled" },
      remindedAt: null,
      startAt: { gte: now, lte: windowEnd },
    },
  })

  if (upcoming.length === 0) return

  const recipients = await prisma.user.findMany({
    where: { notifyAgenda: true },
  })

  if (recipients.length === 0) {
    // Tetap tandai reminded supaya tidak diproses berulang tanpa penerima.
    await prisma.schedule.updateMany({
      where: { id: { in: upcoming.map((s) => s.id) } },
      data: { remindedAt: now },
    })
    return
  }

  for (const schedule of upcoming) {
    // Klaim dulu secara atomic sebelum kirim — kalau ada proses lain (mis. tabrakan
    // rolling-deploy container lama & baru) sudah menandai duluan, count-nya 0 dan
    // kita skip supaya tidak kirim dobel.
    const claim = await prisma.schedule.updateMany({
      where: { id: schedule.id, remindedAt: null },
      data: { remindedAt: now },
    })
    if (claim.count === 0) continue

    const time = formatJakartaTime(schedule.startAt)
    const message = [
      `⏰ Woy, sebentar lagi ada agenda nih~`,
      ``,
      `${schedule.title}`,
      `Jam ${time} WIB${schedule.location ? ` di ${schedule.location}` : ""}`,
      schedule.notes ? `Catatan: ${schedule.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    for (const recipient of recipients) {
      if (recipient.phoneNumber) {
        try {
          await sendWhatsappMessage(recipient.phoneNumber, message)
        } catch (error) {
          console.error(`[cron] Gagal kirim reminder WA ke ${recipient.name}:`, error)
        }
      }
      try {
        await sendPushToUser(recipient.id, { title: "⏰ Pengingat Agenda", body: message, url: "/jadwal" })
      } catch (error) {
        console.error(`[cron] Gagal kirim reminder push ke ${recipient.name}:`, error)
      }
    }
  }
}
