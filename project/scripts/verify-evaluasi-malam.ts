import { createServer } from "node:http"
import { runEveningEvaluation } from "../lib/cron/evening-evaluation"
import { prisma } from "../lib/prisma"

/** Memutar ulang hari Pak Alfan 21/09: dia menyelesaikan satu JADWAL ("buku tamsarnas"), dan
 *  punya satu TUGAS yang jatuh tempo minggu depan. Evaluasi malam melaporkan "Dari 1 tugas hari
 *  ini: 0 selesai, 1 belum" — dua-duanya salah dari sudut pandangnya: yang dia selesaikan tidak
 *  dihitung (karena jadwal, bukan task), dan yang disebut "belum" itu tugas untuk minggu depan.
 *
 *  Ditambah: laporan berupa angka saja bikin ambigu ("1 dari 1" — yang mana?), jadi tiap item
 *  harus disebut judulnya, dan pekerjaan yang DITITIPKAN ke orang lain — jenis tanggungan keempat
 *  yang selama ini tidak pernah muncul di laporan mana pun — juga wajib ikut dilaporkan. */
const terkirim: any[] = []
const ok = (l: string, v: boolean, d = "") => { console.log(`${v ? "✅" : "❌"} ${l}${d ? `  (${d})` : ""}`); if (!v) process.exitCode = 1 }

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) throw new Error("arahkan ke localhost!")
  const server = createServer((req, res) => {
    let raw = ""; req.on("data", c => raw += c)
    req.on("end", () => { try { terkirim.push(JSON.parse(raw)) } catch {}; res.writeHead(200).end("{}") })
  })
  await new Promise<void>(r => server.listen(9099, r))

  const u = await prisma.user.create({
    data: { name: "UJI Evaluasi", email: `ev-${Date.now()}@example.invalid`, phoneNumber: "081977000111",
            sapaan: "Pak Uji", approvedAt: new Date() },
  })
  const siang = new Date(); siang.setUTCHours(5, 0, 0, 0)          // 12:00 WIB hari ini
  const mingguDepan = new Date(Date.now() + 5 * 24 * 3600_000)

  try {
    await prisma.schedule.create({ data: { userId: u.id, title: "buku tamsarnas", startAt: siang, status: "done" } })
    await prisma.task.create({ data: { userId: u.id, title: "Pengingat: Kondangan Adisti", dueDate: mingguDepan } })
    await prisma.task.create({ data: { userId: u.id, title: "Tanda tangan kontrak vendor", dueDate: siang } })
    await prisma.delegation.create({
      data: { userId: u.id, contactName: "Novi", contactPhone: "6281200000000", title: "siapkan draft laporan bulanan" },
    })

    await runEveningEvaluation()
    const pesan = terkirim.find(t => t.number === "6281977000111")?.message ?? ""
    console.log("\n" + pesan.split("\n").map((l: string) => "   " + l).join("\n") + "\n")

    ok("agenda yang selesai disebut judulnya", /buku tamsarnas/.test(pesan))
    ok("tidak lagi melaporkan '0 selesai'", !/0 selesai/.test(pesan))
    ok("tugas yang jatuh tempo hari ini disebut judulnya", /Tanda tangan kontrak vendor/.test(pesan))
    ok("tugas jatuh tempo minggu depan tidak ikut disebut", !/Kondangan Adisti/.test(pesan))
    ok("pekerjaan yang dititipkan ikut dilaporkan", /draft laporan bulanan/.test(pesan) && /Novi/.test(pesan))
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: u.id } })
    await prisma.task.deleteMany({ where: { userId: u.id } })
    await prisma.delegation.deleteMany({ where: { userId: u.id } })
    await prisma.user.delete({ where: { id: u.id } })
    server.close()
  }
}
main().then(() => process.exit(process.exitCode ?? 0))
