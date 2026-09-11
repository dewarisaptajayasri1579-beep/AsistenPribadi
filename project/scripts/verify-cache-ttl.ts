import { prisma } from "../lib/prisma"

/** Buktikan cache prompt bertahan lebih dari 5 menit (TTL 1 jam), bukan cuma 5 menit (default).
 *
 *  Dibaca dari ai_usage_logs, bukan dengan memanggil Claude lagi — dua percobaan sebelumnya gagal
 *  karena mencoba mengarang kondisinya sendiri:
 *
 *  1. Versi pertama berasumsi panggilan pertama pasti MENULIS cache. Salah: cache prompt dikunci
 *     per organisasi + model + prefix, BUKAN per pengguna — jadi panggilan kita sering hanya
 *     membaca entri yang baru ditulis trafik direktur lain di production.
 *  2. Versi kedua menunggu sampai terjadi penulisan. Juga salah: selama ada direktur lain yang
 *     aktif, entri itu terus hidup dan penulisan tidak pernah terjadi.
 *
 *  Yang benar-benar menentukan cuma satu: adakah panggilan yang MEMBACA cache setelah jeda lebih
 *  dari 5 menit tanpa ada aktivitas apapun di sela itu? Kalau ada, entrinya pasti hidup lebih dari
 *  5 menit. Itu terjawab dari log yang sudah terkumpul, tanpa perlu memanggil Claude lagi. */
const BATAS_TTL_LAMA_MENIT = 5

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  const logs = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, cacheCreationTokens: true, cacheReadTokens: true },
  })

  // Hanya lihat sejak PENULISAN cache terakhir. Sebelum titik itu entri yang hidup masih milik
  // kode lama (TTL 5 menit), jadi kedaluwarsa di sana bukan bukti apapun tentang TTL baru —
  // justru itulah yang membuat entri baru ditulis.
  const indeksTulisTerakhir = logs.map((l) => l.cacheCreationTokens > 0).lastIndexOf(true)
  const sejakTulis = indeksTulisTerakhir >= 0 ? logs.slice(indeksTulisTerakhir) : logs

  const jeda = sejakTulis.slice(1).map((log, i) => ({
    menit: (log.createdAt.getTime() - sejakTulis[i].createdAt.getTime()) / 60000,
    tulis: log.cacheCreationTokens,
    baca: log.cacheReadTokens,
  }))

  // Bukti cache hidup: jeda melewati batas TTL lama, lalu dibaca tanpa ditulis ulang.
  const bertahan = jeda.filter((g) => g.menit > BATAS_TTL_LAMA_MENIT && g.baca > 0 && g.tulis === 0)
  // Kontrol: jeda serupa yang justru MEMAKSA tulis ulang = perilaku TTL 5 menit.
  const kedaluwarsa = jeda.filter((g) => g.menit > BATAS_TTL_LAMA_MENIT && g.tulis > 0)

  console.log(`${logs.length} panggilan diperiksa, ${sejakTulis.length} sejak penulisan cache terakhir`)
  for (const g of bertahan) console.log(`  bertahan : jeda ${g.menit.toFixed(1)} menit -> baca ${g.baca}, tulis 0`)
  for (const g of kedaluwarsa) console.log(`  kedaluwarsa: jeda ${g.menit.toFixed(1)} menit -> tulis ${g.tulis}`)
  console.log()

  check(`ada cache yang bertahan melewati ${BATAS_TTL_LAMA_MENIT} menit`, bertahan.length > 0)
  check("tidak ada cache yang kedaluwarsa sejak entri TTL 1 jam ditulis", kedaluwarsa.length === 0)
}

main().then(() => process.exit(process.exitCode ?? 0))
