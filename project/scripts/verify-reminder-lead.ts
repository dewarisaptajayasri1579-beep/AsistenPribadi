import { runTool } from "../lib/agent-tools"
import { prisma } from "../lib/prisma"

/** Menguji dua perbaikan yang lahir dari kasus nyata Pak Alfan:
 *  1. Pengingat khusus ("3 jam sebelumnya") benar-benar TERSIMPAN, bukan diakali jadi jadwal
 *     tambahan berjudul "REMINDER: ..." atau digeser jam acaranya.
 *  2. Saat satu acara telanjur tersimpan KEMBAR, menandai selesai menutup dua-duanya —
 *     supaya tidak ada yang menggantung di daftar pending check-in selamanya. */
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

const jam = (n: number) => new Date(Date.now() + n * 3600_000).toISOString()

async function main() {
  const uji = await prisma.user.create({
    data: { name: "UJI Pengingat", email: `uji-${Date.now()}@example.invalid`, approvedAt: new Date() },
  })
  const ctx = { userId: uji.id }

  try {
    // 1. Pengingat khusus tersimpan apa adanya.
    const a: any = await runTool("create_schedule", { title: "Meetup Klien", startAt: jam(30), remindBeforeMinutes: 180 }, ctx)
    check("pengingat 3 jam tersimpan (180 menit)", a.schedule.remindBeforeMinutes === 180)

    const b: any = await runTool("create_schedule", { title: "Rapat Biasa", startAt: jam(31) }, ctx)
    check("tanpa permintaan khusus tetap default 15 menit", b.schedule.remindBeforeMinutes === 15)

    const c: any = await runTool("create_schedule", { title: "Angka Ngawur", startAt: jam(32), remindBeforeMinutes: -5 }, ctx)
    check("angka tidak masuk akal diabaikan, balik ke 15", c.schedule.remindBeforeMinutes === 15)

    check(
      "TIDAK ada jadwal akal-akalan berjudul 'REMINDER: ...'",
      (await prisma.schedule.count({ where: { userId: uji.id, title: { startsWith: "REMINDER" } } })) === 0
    )

    // 2. Jadwal kembar: satu acara, dua baris (persis kasus Pak Irsyad).
    const k1: any = await runTool("create_schedule", { title: "Meetup Kembar", startAt: jam(1) }, ctx)
    const k2 = await prisma.schedule.create({
      data: { userId: uji.id, title: "Meetup Kembar", startAt: new Date(Date.now() + 3 * 3600_000) },
    })

    const tutup: any = await runTool("complete_schedule", { id: k1.schedule.id }, ctx)
    const sisa = await prisma.schedule.findUniqueOrThrow({ where: { id: k2.id } })

    check("kembarannya ikut ditutup", sisa.status === "done")
    check("jumlah kembar yang ikut ditutup dilaporkan", tutup.jadwalKembarIkutDitutup === 1)

    // 3. Acara BEDA berjudul sama di hari lain tidak boleh ikut tertutup.
    const lain = await prisma.schedule.create({
      data: { userId: uji.id, title: "Meetup Kembar", startAt: new Date(Date.now() + 72 * 3600_000) },
    })
    const k3 = await prisma.schedule.create({
      data: { userId: uji.id, title: "Meetup Kembar", startAt: new Date(Date.now() + 2 * 3600_000) },
    })
    await runTool("complete_schedule", { id: k3.id }, ctx)
    check(
      "acara berjudul sama di HARI LAIN tidak ikut tertutup",
      (await prisma.schedule.findUniqueOrThrow({ where: { id: lain.id } })).status !== "done"
    )
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    await prisma.user.delete({ where: { id: uji.id } })
    console.log("\n(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
