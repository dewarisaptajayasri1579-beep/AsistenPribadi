import { getOwnerRecipients } from "@/lib/cron/recipients"
import { formatJakartaTime } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push"
import { sendWhatsappMessage } from "@/lib/wahub"

const CHECKIN_DELAY_MINUTES = 30

/** Cari jadwal yang sudah lewat waktu selesainya >= 30 menit & belum di-checkin, lalu kirim WA
 *  nanya apakah sudah selesai. Balasan pengguna ditangani lewat get_pending_schedule_checkins /
 *  complete_schedule di agent-tools.ts — bukan lewat riwayat percakapan, supaya tetap valid
 *  walau balasan datang setelah WhatsappThread idle-reset. */
export async function runScheduleCheckins() {
  const now = new Date()
  const threshold = new Date(now.getTime() - CHECKIN_DELAY_MINUTES * 60 * 1000)

  const due = await prisma.schedule.findMany({
    where: {
      status: { notIn: ["cancelled", "done"] },
      checkinAt: null,
      OR: [
        { endAt: { lte: threshold } },
        { endAt: null, startAt: { lte: new Date(threshold.getTime() - 60 * 60 * 1000) } },
      ],
    },
  })

  if (due.length === 0) return

  // Check-in dikirim ke PEMILIK jadwalnya masing-masing — lihat lib/cron/recipients.ts.
  const recipients = await getOwnerRecipients(
    due.map((s) => s.userId),
    "notifyAgenda"
  )

  for (const schedule of due) {
    // Klaim dulu secara atomic — sama seperti pola remindedAt di schedule-reminders.ts.
    const claim = await prisma.schedule.updateMany({
      where: { id: schedule.id, checkinAt: null },
      data: { checkinAt: now },
    })
    if (claim.count === 0) continue

    // Sudah diklaim di atas supaya tidak ditanyakan berulang, walau pemiliknya mematikan notifikasi.
    const recipient = recipients.get(schedule.userId)
    if (!recipient) continue

    const time = formatJakartaTime(schedule.startAt)
    const message = [
      `Mas Ony~ jangan lupa jadwal "${schedule.title}" (mulai ${time} WIB) tadi 👋`,
      ``,
      `Udah selesai apa belum nih? Balas "sudah" atau "belum" ya mas~`,
    ].join("\n")

    if (recipient.phoneNumber) {
      try {
        await sendWhatsappMessage(recipient.phoneNumber, message)
      } catch (error) {
        console.error(`[cron] Gagal kirim checkin WA ke ${recipient.name}:`, error)
      }
    }
    try {
      await sendPushToUser(recipient.id, { title: "👋 Cek status jadwal", body: message, url: "/jadwal" })
    } catch (error) {
      console.error(`[cron] Gagal kirim checkin push ke ${recipient.name}:`, error)
    }
  }
}
