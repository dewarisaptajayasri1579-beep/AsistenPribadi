import { createServer } from "node:http"
import { prisma } from "../lib/prisma"
import { handleWhatsappWebhook } from "../lib/whatsapp-webhook"

/** Skenario nyata 20/09: Pak Alfan MEMBALAS briefing pagi dengan "ini sudah selesai dan diterima
 *  bukunya". Naya tidak paham karena dua hal — WAHUB tidak meneruskan pesan yang dikutip, dan
 *  pesan cron tidak pernah masuk riwayat percakapan. Setelah quotedBody diteruskan, Naya harus
 *  tahu "ini" merujuk ke apa. */
const terkirim: any[] = []
const CLIENT = "02c04786-e09f-41bc-82bd-6c4615f8eb2a"
const ok = (l: string, v: boolean, d = "") => { console.log(`${v ? "✅" : "❌"} ${l}${d ? `  (${d})` : ""}`); if (!v) process.exitCode = 1 }

const BRIEFING = `Pagi Pak Alfan! ☀️ Naya rangkumin agenda hari ini ya~

Agenda:
- 12:00 Ambil buku di percetakan (kantor)

Prioritas:
1. Ambil buku cetakan dari percetakan`

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) throw new Error("arahkan ke localhost!")
  const server = createServer((req, res) => {
    let raw = ""; req.on("data", c => raw += c)
    req.on("end", () => { try { terkirim.push(JSON.parse(raw)) } catch {}; res.writeHead(200).end("{}") })
  })
  await new Promise<void>(r => server.listen(9099, r))

  const u = await prisma.user.create({
    data: { name: "UJI Reply", email: `q-${Date.now()}@example.invalid`, phoneNumber: "081966000111",
            sapaan: "Pak Uji", approvedAt: new Date() },
  })
  const besok = new Date(Date.now() + 3600_000)
  await prisma.schedule.create({ data: { userId: u.id, title: "Ambil buku di percetakan", startAt: besok } })

  try {
    for (const [label, quoted] of [["TANPA kutipan (perilaku lama)", null], ["DENGAN kutipan (perbaikan)", BRIEFING]] as const) {
      terkirim.length = 0
      await prisma.whatsappThread.deleteMany({ where: { userId: u.id } })
      await handleWhatsappWebhook({
        sessionId: `${CLIENT}-default`,
        message: { from: "6281966000111@s.whatsapp.net", senderNumber: "6281966000111", to: "me",
                   body: "naya. ini sudah selesai dan diterima bukunya", quotedBody: quoted },
      })
      const balasan = terkirim.map(t => t.message).join(" ")
      const paham = /buku|percetakan/i.test(balasan)
      console.log(`\n▸ ${label}`)
      console.log(`  ${balasan.replace(/\n+/g, " ").slice(0, 130)}`)
      if (quoted) ok("  Naya menyebut pekerjaan yang dimaksud", paham)
      else console.log(`  (menyebut pekerjaannya? ${paham ? "ya" : "tidak"})`)
    }
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: u.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: u.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: u.id } })
    await prisma.agentRun.deleteMany({ where: { userId: u.id } })
    await prisma.user.delete({ where: { id: u.id } })
    server.close()
  }
}
main().then(() => process.exit(process.exitCode ?? 0))
