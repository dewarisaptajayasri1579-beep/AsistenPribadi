import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"

/** Kasus nyata Pak Alfan: dia minta jadwal dipindah, Naya malah bertanya berulang lalu membuat
 *  jadwal BARU — yang lama tertinggal jadi duplikat dan terus ditanyakan berhari-hari kemudian.
 *  Penyebabnya tidak ada tool update_schedule sama sekali (tugas punya update_task, jadwal tidak).
 *
 *  Diuji lewat runAgent, bukan runTool langsung: yang mau dibuktikan justru apakah AI MEMILIH
 *  tool yang benar dari kalimat sehari-hari — memanggil tool-nya sendiri tidak membuktikan itu. */
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  const uji = await prisma.user.create({
    data: { name: "UJI Ubah Jadwal", email: `ubah-${Date.now()}@example.invalid`, sapaan: "Mas Uji", approvedAt: new Date() },
  })

  try {
    const besok = new Date(Date.now() + 24 * 3600_000)
    besok.setUTCHours(3, 0, 0, 0) // 10:00 WIB
    const awal = await prisma.schedule.create({
      data: { userId: uji.id, title: "Meetup Pak Irsyad", startAt: besok, endAt: new Date(besok.getTime() + 3600_000), location: "Rawamangun" },
    })

    const { reply, messages } = await runAgent({
      ownerId: uji.id,
      actorId: uji.id,
      sapaan: "Mas Uji",
      command: "Meetup Pak Irsyad besok jam 10.00 itu dirubah jadi jam 19.00 ya",
    })

    const tools = messages.flatMap((m) =>
      Array.isArray(m.content) ? m.content.filter((b: any) => b.type === "tool_use").map((b: any) => b.name) : []
    )
    console.log(`TOOL   : ${tools.join(", ") || "(tidak ada)"}`)
    console.log(`BALASAN: ${reply.replace(/\n+/g, " ").slice(0, 120)}\n`)

    const semua = await prisma.schedule.findMany({ where: { userId: uji.id } })
    const sesudah = await prisma.schedule.findUniqueOrThrow({ where: { id: awal.id } })
    const jamWib = (sesudah.startAt.getTime() + 7 * 3600_000) % 86400_000 / 3600_000

    check("memakai update_schedule", tools.includes("update_schedule"))
    check("TIDAK membuat jadwal baru", !tools.includes("create_schedule"))
    check("TIDAK minta izin hapus / memanggil delete", !tools.includes("delete_schedule"))
    check("tetap hanya ada 1 jadwal (tidak jadi duplikat)", semua.length === 1)
    check("jamnya benar-benar berubah jadi 19.00 WIB", jamWib === 19)
    check("durasi 1 jam ikut bergeser, bukan hilang", sesudah.endAt!.getTime() - sesudah.startAt.getTime() === 3600_000)
    check("lokasi tidak ikut terhapus", sesudah.location === "Rawamangun")
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: uji.id } })
    await prisma.agentRun.deleteMany({ where: { userId: uji.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: uji.id } })
    await prisma.user.delete({ where: { id: uji.id } })
    console.log("(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
