import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"

/** "Kerjaanku yang belum selesai apa" harus dijawab dengan JUDUL tiap item, bukan jumlahnya —
 *  jawaban "ada 2 tugas dan 1 jadwal" memaksa atasan bertanya lagi. Sekaligus memastikan
 *  pekerjaan yang dititipkan ke orang lain (jenis tanggungan keempat) ikut disebut. */
const ok = (l: string, v: boolean) => { console.log(`${v ? "✅" : "❌"} ${l}`); if (!v) process.exitCode = 1 }

async function main() {
  const u = await prisma.user.create({
    data: { name: "UJI Sebut", email: `sebut-${Date.now()}@example.invalid`, sapaan: "Pak Uji", approvedAt: new Date() },
  })
  try {
    await prisma.task.create({ data: { userId: u.id, title: "Review anggaran renovasi kantor", priority: "high" } })
    await prisma.followUp.create({ data: { userId: u.id, title: "Konfirmasi harga ke Pak Hendra", relatedPerson: "Pak Hendra" } })
    await prisma.schedule.create({
      data: { userId: u.id, title: "Rapat evaluasi cabang Bekasi", startAt: new Date(Date.now() - 3 * 3600_000) },
    })
    await prisma.delegation.create({
      data: { userId: u.id, contactName: "Novi", contactPhone: "6281200000000", title: "siapkan draft laporan bulanan" },
    })

    const { reply } = await runAgent({ ownerId: u.id, actorId: u.id, sapaan: "Pak Uji", command: "kerjaanku yang belum selesai apa?" })
    console.log("\n" + reply.split("\n").map(l => "   " + l).join("\n") + "\n")

    ok("tugas disebut judulnya", /renovasi kantor/i.test(reply))
    ok("follow-up disebut judulnya", /Hendra/i.test(reply))
    ok("jadwal belum ditutup disebut judulnya", /Bekasi/i.test(reply))
    ok("yang dititipkan ke orang lain ikut disebut", /laporan bulanan/i.test(reply) && /Novi/i.test(reply))
  } finally {
    for (const d of [prisma.task, prisma.followUp, prisma.schedule, prisma.delegation, prisma.aiUsageLog, prisma.agentRun, prisma.whatsappThread] as any[]) {
      await d.deleteMany({ where: { userId: u.id } })
    }
    await prisma.user.delete({ where: { id: u.id } })
  }
}
main().then(() => process.exit(process.exitCode ?? 0))
