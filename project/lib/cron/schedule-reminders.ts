import { formatJakartaTime } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
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
    where: { notifyAgenda: true, phoneNumber: { not: null } },
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
    const time = formatJakartaTime(schedule.startAt)
    const message = [
      `⏰ Pengingat Agenda`,
      ``,
      `${schedule.title}`,
      `Pukul ${time} WIB${schedule.location ? ` di ${schedule.location}` : ""}`,
      schedule.notes ? `Catatan: ${schedule.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    for (const recipient of recipients) {
      if (!recipient.phoneNumber) continue
      try {
        await sendWhatsappMessage(recipient.phoneNumber, message)
      } catch (error) {
        console.error(`[cron] Gagal kirim reminder ke ${recipient.name}:`, error)
      }
    }

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { remindedAt: now },
    })
  }
}
