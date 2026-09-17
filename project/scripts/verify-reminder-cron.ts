import { createServer } from "node:http"

import { runScheduleReminders } from "../lib/cron/schedule-reminders"
import { prisma } from "../lib/prisma"

/** Buktikan cron pengingat memakai jeda PER JADWAL, bukan konstanta 15 menit.
 *  WAHUB diarahkan ke server tiruan lokal — tidak ada WA sungguhan yang terkirim. */
const terkirim: { number: string; message: string }[] = []

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

const menitLagi = (n: number) => new Date(Date.now() + n * 60_000)

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) {
    throw new Error("WAHUB_BASE_URL harus diarahkan ke server tiruan lokal!")
  }

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      try {
        terkirim.push(JSON.parse(raw))
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ success: true }))
    })
  })
  await new Promise<void>((r) => server.listen(9099, r))

  const uji = await prisma.user.create({
    data: {
      name: "UJI Cron",
      email: `uji-cron-${Date.now()}@example.invalid`,
      phoneNumber: "081999777555",
      approvedAt: new Date(),
      notifyAgenda: true,
    },
  })

  try {
    // Mulai 2 jam lagi, minta diingatkan 3 jam sebelumnya -> jendelanya SUDAH lewat, harus dikirim.
    const awal = await prisma.schedule.create({
      data: { userId: uji.id, title: "UJI Ingat 3 Jam", startAt: menitLagi(120), remindBeforeMinutes: 180 },
    })
    // Mulai 2 jam lagi, pengingat default 15 menit -> BELUM waktunya, tidak boleh dikirim.
    const nanti = await prisma.schedule.create({
      data: { userId: uji.id, title: "UJI Default 15", startAt: menitLagi(120) },
    })

    await runScheduleReminders()

    const keUji = terkirim.filter((t) => t.number === "6281999777555")
    console.log(`\n(${keUji.length} pengingat terkirim ke nomor uji)`)
    for (const t of keUji) console.log(`  "${t.message.split("\n")[0]}"`)
    console.log()

    check("jadwal dengan pengingat 3 jam DIKIRIM", keUji.some((t) => t.message.includes("UJI Ingat 3 Jam")))
    check("jadwal pengingat default 15 menit BELUM dikirim", !keUji.some((t) => t.message.includes("UJI Default 15")))
    check(
      "kalimat pembuka menyesuaikan jeda (bukan 'sebentar lagi')",
      keUji.some((t) => t.message.includes("2 jam lagi"))
    )
    check(
      "hanya yang terkirim yang ditandai remindedAt",
      (await prisma.schedule.findUniqueOrThrow({ where: { id: awal.id } })).remindedAt !== null &&
        (await prisma.schedule.findUniqueOrThrow({ where: { id: nanti.id } })).remindedAt === null
    )
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    await prisma.user.delete({ where: { id: uji.id } })
    server.close()
    console.log("(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
