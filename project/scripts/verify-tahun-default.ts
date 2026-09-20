import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"

/** Tanggal tanpa tahun harus jatuh di TAHUN BERJALAN, bukan tahun depan.
 *
 *  Model tidak punya aturan apapun soal ini sebelumnya — ia hanya menerima "Waktu sekarang" lalu
 *  menebak sendiri, dan tebakan yang masuk akal baginya ("tanggal itu sudah lewat, berarti
 *  maksudnya tahun depan") justru salah: orang menyebut tanggal tanpa tahun hampir selalu
 *  memaksudkan tahun ini. */
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  const uji = await prisma.user.create({
    data: { name: "UJI Tahun", email: `thn-${Date.now()}@example.invalid`, sapaan: "Pak Uji", approvedAt: new Date() },
  })
  const tahunIni = new Date().getUTCFullYear()

  try {
    const kasus = [
      { perintah: "jadwalkan 27 Desember jam 10.00, rapat tutup tahun", harap: tahunIni, ket: "masih di tahun ini" },
      { perintah: "buat jadwal 3 November jam 09.00, audit kantor", harap: tahunIni, ket: "beberapa bulan ke depan" },
    ]

    // Kebalikannya: waktu yang benar-benar belum jelas HARUS tetap ditanyakan.
    const { reply: tanya } = await runAgent({
      ownerId: uji.id, actorId: uji.id, sapaan: "Pak Uji",
      command: "jadwalkan meeting dengan tim minggu depan ya",
    })
    const adaJadwal = await prisma.schedule.count({ where: { userId: uji.id } })
    check("waktu belum jelas tetap DITANYAKAN, bukan ditebak", adaJadwal === 0 && /\?/.test(tanya),
      tanya.replace(/\n+/g, " ").slice(0, 60))
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })

    // Tanggal yang SUDAH LEWAT. Yang dilarang cuma satu: diam-diam memakai tahun depan.
    // Bertanya balik boleh — untuk tanggal yang sudah berlalu itu justru lebih aman daripada
    // menyimpan jadwal yang tidak akan pernah mengingatkan siapapun.
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    const { reply: lewat } = await runAgent({
      ownerId: uji.id, actorId: uji.id, sapaan: "Pak Uji",
      command: "buatkan jadwal tanggal 12 September jam 14.00, meeting internal",
    })
    const dibuat = await prisma.schedule.findFirst({ where: { userId: uji.id } })
    const tahunDibuat = dibuat ? new Date(dibuat.startAt.getTime() + 7 * 3600_000).getUTCFullYear() : null
    check(
      "tanggal yang sudah lewat TIDAK diam-diam dilempar ke tahun depan",
      tahunDibuat === null || tahunDibuat === tahunIni,
      tahunDibuat ? `dibuat tahun ${tahunDibuat}` : "ditanyakan dulu"
    )
    check("kalau bertanya, tidak menawarkan tahun depan sebagai jawaban", !/tahun depan|2027/i.test(lewat),
      /tahun depan|2027/i.test(lewat) ? lewat.replace(/\n+/g," ").slice(0,70) : "")
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })

    for (const k of kasus) {
      await prisma.schedule.deleteMany({ where: { userId: uji.id } })
      const { reply } = await runAgent({ ownerId: uji.id, actorId: uji.id, sapaan: "Pak Uji", command: k.perintah })

      const s = await prisma.schedule.findFirst({ where: { userId: uji.id }, orderBy: { startAt: "desc" } })
      if (!s) {
        check(`${k.ket}: jadwal dibuat`, false, "tidak ada jadwal tersimpan")
        console.log(`   balasan: ${reply.replace(/\n+/g, " ").slice(0, 90)}`)
        continue
      }
      const tahun = new Date(s.startAt.getTime() + 7 * 3600_000).getUTCFullYear()
      check(`${k.ket}: pakai tahun ${tahunIni}`, tahun === k.harap, `tersimpan ${tahun}`)

      // Tanggal yang sudah lewat harus disebutkan, bukan disimpan diam-diam.
      if (s.startAt.getTime() < Date.now()) {
        const menyebut = /lewat|lalu|kemarin|sudah berlalu|sudah lewat/i.test(reply)
        check(`${k.ket}: balasannya memberi tahu tanggalnya sudah lewat`, menyebut,
          menyebut ? "" : reply.replace(/\n+/g, " ").slice(0, 70))
      }
    }
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: uji.id } })
    await prisma.agentRun.deleteMany({ where: { userId: uji.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: uji.id } })
    await prisma.user.delete({ where: { id: uji.id } })
    console.log("\n(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
