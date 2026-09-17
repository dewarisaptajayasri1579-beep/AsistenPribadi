import { getOwnerRecipients } from "@/lib/cron/recipients"
import { formatJakartaTime } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push"
import { outgoingSessionId } from "@/lib/wa-session"
import { sendWhatsappMessage } from "@/lib/wahub"

// Batas atas jendela pencarian saja — jeda pengingat sebenarnya dibaca per jadwal dari
// remindBeforeMinutes. 30 hari menampung permintaan terjauh yang masuk akal ("seminggu sebelumnya").
const MAX_LEAD_MINUTES = 30 * 24 * 60

/** Kalimat pembuka pengingat harus ikut jeda yang diminta pengguna — "sebentar lagi" jadi
 *  membingungkan kalau pengingatnya dipasang sehari sebelumnya. */
function leadLabel(startAt: Date, now: Date) {
  const menit = Math.round((startAt.getTime() - now.getTime()) / 60000)
  if (menit >= 1440) {
    const hari = Math.round(menit / 1440)
    return hari === 1 ? "besok" : `${hari} hari lagi`
  }
  if (menit >= 60) return `${Math.round(menit / 60)} jam lagi`
  if (menit >= 2) return `${menit} menit lagi`
  return "sebentar lagi"
}

/** Cari jadwal yang sudah masuk jendela pengingatnya MASING-MASING & belum diingatkan, lalu kirim WA.
 *  Dulu jendelanya satu konstanta 15 menit untuk semua jadwal, sehingga permintaan seperti
 *  "ingatkan 3 jam sebelumnya" tidak mungkin dipenuhi — lihat kolom remindBeforeMinutes. */
export async function runScheduleReminders() {
  const now = new Date()

  // Perbandingan "startAt - remindBeforeMinutes <= now" membandingkan kolom dengan kolom, yang
  // tidak bisa ditulis di filter Prisma biasa. Jadi ambil kandidat dengan batas terluas dulu,
  // lalu saring di sini — jumlahnya kecil (hanya jadwal mendatang yang belum diingatkan).
  const candidates = await prisma.schedule.findMany({
    where: {
      status: { not: "cancelled" },
      remindedAt: null,
      startAt: { gte: now, lte: new Date(now.getTime() + MAX_LEAD_MINUTES * 60 * 1000) },
    },
  })

  const upcoming = candidates.filter(
    (s) => s.startAt.getTime() - s.remindBeforeMinutes * 60 * 1000 <= now.getTime()
  )

  if (upcoming.length === 0) return

  // Reminder dikirim ke PEMILIK jadwalnya masing-masing, bukan ke semua user yang mengaktifkan
  // notifyAgenda — lihat penjelasan di lib/cron/recipients.ts.
  const recipients = await getOwnerRecipients(
    upcoming.map((s) => s.userId),
    "notifyAgenda"
  )

  for (const schedule of upcoming) {
    // Klaim dulu secara atomic sebelum kirim — kalau ada proses lain (mis. tabrakan
    // rolling-deploy container lama & baru) sudah menandai duluan, count-nya 0 dan
    // kita skip supaya tidak kirim dobel.
    const claim = await prisma.schedule.updateMany({
      where: { id: schedule.id, remindedAt: null },
      data: { remindedAt: now },
    })
    if (claim.count === 0) continue

    // Sudah diklaim di atas supaya tidak diproses berulang, walau ternyata pemiliknya mematikan
    // notifikasi agenda (atau akunnya sudah tidak ada).
    const recipient = recipients.get(schedule.userId)
    if (!recipient) continue

    const time = formatJakartaTime(schedule.startAt)
    const message = [
      `⏰ Woy, ${leadLabel(schedule.startAt, now)} ada agenda nih~`,
      ``,
      `${schedule.title}`,
      `Jam ${time} WIB${schedule.location ? ` di ${schedule.location}` : ""}`,
      schedule.notes ? `Catatan: ${schedule.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    if (recipient.phoneNumber) {
      try {
        await sendWhatsappMessage(recipient.phoneNumber, message, outgoingSessionId(recipient))
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
