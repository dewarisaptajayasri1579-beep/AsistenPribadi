import { prisma } from "@/lib/prisma"

type NotifyFlag = "notifyAgenda" | "notifyDailyReport" | "notifyPriorityAlert" | "notifyMorningBriefing"

/** Siapa yang boleh dikirimi notifikasi tentang data milik sekumpulan owner tertentu.
 *
 *  PENTING: notifikasi HARUS ditujukan ke pemilik datanya (schedule.userId), bukan disebar ke
 *  semua user yang kebetulan mengaktifkan flag notifikasinya. Sebelum ini cron mengambil
 *  `prisma.user.findMany({ where: { notifyAgenda: true } })` sekali lalu mengirim SETIAP jadwal
 *  ke SEMUA user itu — aman selama user cuma satu, tapi begitu ada direktur kedua, jadwal
 *  direktur A ikut ter-WA ke direktur B dan sebaliknya.
 *
 *  Saat workspace multi-direktur aktif, di fungsi inilah anggota workspace lain (mis. sekretaris
 *  yang owner_id-nya menunjuk ke direktur) ditambahkan sebagai penerima — cukup satu tempat,
 *  tidak perlu menyentuh tiap cron lagi. */
export async function getOwnerRecipients(ownerIds: string[], flag: NotifyFlag) {
  const unique = [...new Set(ownerIds)]
  if (unique.length === 0) {
    return new Map<string, { id: string; name: string; sapaan: string | null; phoneNumber: string | null; wahubSessionId: string | null }>()
  }

  const users = await prisma.user.findMany({
    where: { id: { in: unique }, [flag]: true },
    // sapaan dipakai menyapa penerima; wahubSessionId menentukan pesannya dikirim dari NOMOR
    // mana (nomor Naya bersama atau nomor sendiri milik direktur ini).
    select: { id: true, name: true, sapaan: true, phoneNumber: true, wahubSessionId: true },
  })

  return new Map(users.map((u) => [u.id, u]))
}
