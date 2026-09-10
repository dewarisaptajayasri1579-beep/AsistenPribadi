import { createServer } from "node:http"

import { prisma } from "../lib/prisma"

/** Server tiruan WAHUB: mencatat tiap kiriman, tidak mengirim WhatsApp sungguhan.
 *  Dipakai dengan WAHUB_BASE_URL=http://localhost:PORT saat menjalankan skrip ini. */
const sent: { number: string; message: string }[] = []

const PORT = Number(process.env.FAKE_WAHUB_PORT ?? 9099)

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) {
    throw new Error("WAHUB_BASE_URL harus diarahkan ke server tiruan lokal — jangan kirim WA sungguhan!")
  }

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      try {
        const { number, message } = JSON.parse(body)
        sent.push({ number, message })
      } catch {
        /* abaikan */
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ success: true }))
    })
  })
  await new Promise<void>((r) => server.listen(PORT, r))

  const ony = await prisma.user.findFirstOrThrow({ where: { isOwner: true } })
  const budi = await prisma.user.create({
    data: {
      name: "TEST Budi Cron",
      email: "test-budi-cron@example.invalid",
      phoneNumber: "081999000111",
      approvedAt: new Date(),
    },
  })

  try {
    // Data yang HANYA milik Budi — kalau muncul di pesan Ony (atau sebaliknya), berarti bocor.
    await prisma.task.create({
      data: { userId: budi.id, title: "PENANDA-BUDI audit gudang", priority: "high", dueDate: new Date() },
    })
    await prisma.motivationMessage.create({
      data: { userId: budi.id, content: "PENANDA-BUDI tetap tenang dan fokus", source: "manual" },
    })

    const { runMorningBriefing } = await import("../lib/cron/morning-briefing")
    const { runEveningEvaluation } = await import("../lib/cron/evening-evaluation")
    const { runMotivationMessage } = await import("../lib/cron/motivation-message")

    await runMorningBriefing()
    await runEveningEvaluation()
    await runMotivationMessage()

    const toBudi = sent.filter((s) => s.number === "6281999000111")
    const toOny = sent.filter((s) => s.number !== "6281999000111")

    console.log(`\n(${sent.length} kiriman tercatat: ${toOny.length} ke Ony, ${toBudi.length} ke Budi)\n`)

    check("Budi menerima kiriman (briefing/evaluasi/motivasi)", toBudi.length > 0)
    check("Ony tetap menerima kirimannya sendiri", toOny.length > 0)
    check(
      "pesan ke Ony TIDAK memuat data Budi",
      toOny.every((s) => !s.message.includes("PENANDA-BUDI"))
    )
    check(
      "pesan ke Budi TIDAK memuat data Ony",
      toBudi.every((s) => !/Panda|Fantech|JS Berkah/.test(s.message))
    )
    check(
      "briefing Budi memuat tugas Budi sendiri",
      toBudi.some((s) => s.message.includes("PENANDA-BUDI audit gudang"))
    )
    check("tidak ada nomor asing yang dikirimi", sent.every((s) => /^62/.test(s.number)))
  } finally {
    await prisma.task.deleteMany({ where: { userId: budi.id } })
    await prisma.motivationMessage.deleteMany({ where: { userId: budi.id } })
    await prisma.user.delete({ where: { id: budi.id } })
    server.close()
    console.log("(data uji dibersihkan)")
    void ony
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
