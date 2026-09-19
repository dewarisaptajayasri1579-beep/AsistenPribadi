import { createServer } from "node:http"

import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"
import { handleWhatsappWebhook } from "../lib/whatsapp-webhook"

/** Simulasi persis skenario yang diminta: seorang direktur menyuruh Naya menghubungi orang lain,
 *  lalu orang itu membalas. Sengaja lewat runAgent supaya yang diuji juga apakah AI MEMILIH tool
 *  yang benar dari kalimat sehari-hari. Semua WA diarahkan ke server tiruan. */
const terkirim: { number: string; message: string; sessionId?: string }[] = []
const CLIENT = "02c04786-e09f-41bc-82bd-6c4615f8eb2a"

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

  const direktur = await prisma.user.create({
    // Meniru setelan Pak Alfan: dia pakai NOMOR WA SENDIRI, bukan nomor Naya bersama.
    // Balasan penerima karena itu masuk lewat sesi pribadinya, bukan sesi default.
    data: { name: "TRIAL Direktur", email: `trial-${Date.now()}@example.invalid`, phoneNumber: "081955000111",
            sapaan: "Pak Trial", approvedAt: new Date(), wahubSessionId: `dir-trial${Date.now() % 100000}` },
  })

  try {
    console.log("── Direktur mengetik ke Naya:")
    console.log('   "Tolong WA ke Ony 087739255404, tanyakan progress pekerjaannya bagaimana?"\n')

    const { reply, messages } = await runAgent({
      ownerId: direktur.id,
      actorId: direktur.id,
      sapaan: "Pak Trial",
      command: "Tolong WA ke Ony 087739255404, Tanyakan progress pekerjaannya bagaimana?",
    })

    const tools = messages.flatMap((m) =>
      Array.isArray(m.content) ? m.content.filter((b: any) => b.type === "tool_use").map((b: any) => b.name) : []
    )
    console.log(`TOOL DIPILIH : ${tools.join(", ") || "(tidak ada)"}`)
    console.log(`BALASAN NAYA : ${reply.replace(/\n+/g, " ").slice(0, 150)}\n`)

    for (const t of terkirim) {
      console.log(`WA TERKIRIM  → ${t.number} (sesi: ${t.sessionId ?? "default"})`)
      console.log(t.message.split("\n").map((l) => "               " + l).join("\n") + "\n")
    }

    // Sekarang bagian yang belum pernah diuji: penerimanya kebetulan DIREKTUR TERDAFTAR.
    console.log(`── Ony membalas "sudah" ke nomor Naya milik direktur (sesi ${direktur.wahubSessionId}):`)
    terkirim.length = 0
    const hasil = await handleWhatsappWebhook({
      sessionId: `${CLIENT}-${direktur.wahubSessionId}`,
      message: { from: "6287739255404@s.whatsapp.net", senderNumber: "6287739255404", to: "me", body: "sudah" },
    })
    console.log(`   hasil webhook: ${JSON.stringify(hasil)}`)

    const delegasi = await prisma.delegation.findFirst({ where: { userId: direktur.id } })
    console.log(`   status delegasi sesudahnya: ${delegasi?.status ?? "(tidak ada delegasi)"}`)
    console.log(`   WA balik ke direktur: ${terkirim.filter((t) => t.number === "6281955000111").length} pesan`)
  } finally {
    await prisma.delegation.deleteMany({ where: { userId: direktur.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: direktur.id } })
    await prisma.agentRun.deleteMany({ where: { userId: direktur.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: direktur.id } })
    await prisma.user.delete({ where: { id: direktur.id } })
    server.close()
    console.log("\n(data uji dibersihkan — tidak ada WA sungguhan terkirim)")
  }
}

main().then(() => process.exit(0))
