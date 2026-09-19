import {
  MAX_HARI_TANPA_BALASAN,
  kabariDirektur,
  kirimKePenerima,
} from "@/lib/delegation"
import { prisma } from "@/lib/prisma"
import { sapaanOf } from "@/lib/sapaan"

const HARI_MS = 24 * 60 * 60 * 1000
/** Jangan kirim dua kali dalam satu slot kalau cron kebetulan jalan dobel (mis. rolling deploy). */
const JEDA_MIN_MS = 4 * 60 * 60 * 1000

/** Tanya progres ke penerima delegasi. Dipanggil dua kali sehari (08:00 & 15:00 WIB).
 *
 *  Penerimanya BUKAN pengguna aplikasi ini — dia tidak pernah mendaftar dan tidak punya kewajiban
 *  membalas. Karena itu ada batas keras: setelah MAX_HARI_TANPA_BALASAN hari tanpa balasan sama
 *  sekali, pengejaran dihentikan dan direkturnya yang dikabari. Mengejar orang tanpa batas adalah
 *  cara tercepat nomor WhatsApp dilaporkan sebagai spam lalu diblokir. */
export async function runDelegationReminders() {
  const now = new Date()

  const terbuka = await prisma.delegation.findMany({
    where: { status: "menunggu", optedOut: false },
    include: { user: true },
  })

  for (const d of terbuka) {
    try {
      const acuan = d.lastReplyAt ?? d.createdAt
      const hariDiam = (now.getTime() - acuan.getTime()) / HARI_MS

      if (hariDiam >= MAX_HARI_TANPA_BALASAN) {
        await prisma.delegation.update({ where: { id: d.id }, data: { status: "dihentikan" } })
        await kabariDirektur(
          d,
          `⚠️ ${sapaanOf(d.user)}, ${d.contactName} belum merespons soal "${d.title}" selama ${MAX_HARI_TANPA_BALASAN} hari. Aku stop ngingetin ya — mungkin lebih baik dihubungi langsung.`
        )
        continue
      }

      if (d.lastRemindedAt && now.getTime() - d.lastRemindedAt.getTime() < JEDA_MIN_MS) continue

      // Diklaim dulu sebelum kirim — pola yang sama dengan reminder jadwal, supaya dua container
      // yang jalan bersamaan tidak mengirim dobel ke orang luar.
      const klaim = await prisma.delegation.updateMany({
        where: {
          id: d.id,
          OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: new Date(now.getTime() - JEDA_MIN_MS) } }],
        },
        data: { lastRemindedAt: now, remindedCount: { increment: 1 } },
      })
      if (klaim.count === 0) continue

      await kirimKePenerima(
        d,
        [
          `Halo ${d.contactName}, izin nanya progres ya 🙏`,
          `📌 ${d.title}`,
          ``,
          `Kalau sudah kelar balas "sudah", kalau belum balas "belum" aja. Makasih!`,
        ].join("\n")
      )
    } catch (error) {
      console.error(`[cron] pengingat delegasi gagal untuk ${d.contactName}:`, error)
    }
  }
}
