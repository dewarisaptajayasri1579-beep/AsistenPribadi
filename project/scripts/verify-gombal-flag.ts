import { createServer } from "node:http"

import { runGombalMessage } from "../lib/cron/gombal-message"
import { prisma } from "../lib/prisma"

/** Gombalan dulu terkirim ke SIAPAPUN yang punya nomor WA — tanpa flag, tanpa cara mematikan.
 *  Sekarang harus menghormati notifyGombal, yang default-nya MATI untuk akun baru. */
const terkirim: { number: string }[] = []

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) throw new Error("arahkan WAHUB_BASE_URL ke localhost!")

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      try { terkirim.push(JSON.parse(raw)) } catch {}
      res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}")
    })
  })
  await new Promise<void>((r) => server.listen(9099, r))

  const mati = await prisma.user.create({
    data: { name: "UJI Gombal Mati", email: `g-off-${Date.now()}@example.invalid`, phoneNumber: "081900000001", approvedAt: new Date() },
  })
  const hidup = await prisma.user.create({
    data: { name: "UJI Gombal Hidup", email: `g-on-${Date.now()}@example.invalid`, phoneNumber: "081900000002", approvedAt: new Date(), notifyGombal: true },
  })

  try {
    check("akun baru default-nya TIDAK menerima gombalan", mati.notifyGombal === false)

    // Cron-nya berbasis undian, jadi dijalankan berkali-kali: yang mati harus tetap nol berapa kali pun.
    for (let i = 0; i < 40; i++) await runGombalMessage()

    check("nol gombalan ke akun yang mematikannya", !terkirim.some((t) => t.number === "6281900000001"))
    console.log(`  (${terkirim.length} kiriman tercatat total, ${terkirim.filter(t=>t.number==="6281900000002").length} ke akun yang menyalakan)`)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [mati.id, hidup.id] } } })
    server.close()
    console.log("(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
