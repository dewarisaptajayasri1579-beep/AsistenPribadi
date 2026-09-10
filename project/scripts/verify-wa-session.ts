import { createServer } from "node:http"

import { prisma } from "../lib/prisma"
import { handleWhatsappWebhook } from "../lib/whatsapp-webhook"
import { sessionIdFor } from "../lib/wa-session"

/** Routing sesi WhatsApp: pesan yang masuk lewat nomor pribadi seorang direktur tidak boleh
 *  dilayani untuk workspace orang lain, dan balasannya harus keluar dari sesi yang sama.
 *
 *  Sengaja memakai pesan pintasan "##" (motivasi) supaya jalurnya deterministik & tidak memanggil
 *  Claude sama sekali — yang diuji di sini routing-nya, bukan kecerdasannya. */
const sent: { number: string; message: string; sessionId?: string }[] = []

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

const CLIENT_ID = "02c04786-e09f-41bc-82bd-6c4615f8eb2a"

function payloadFrom(sessionShortId: string, senderDigits: string, body: string) {
  return {
    sessionId: `${CLIENT_ID}-${sessionShortId}`,
    message: { from: `${senderDigits}@s.whatsapp.net`, senderNumber: senderDigits, to: "me", body },
  }
}

async function main() {
  if (!process.env.WAHUB_BASE_URL?.includes("localhost")) {
    throw new Error("WAHUB_BASE_URL harus diarahkan ke server tiruan lokal — jangan kirim WA sungguhan!")
  }

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      try {
        sent.push(JSON.parse(raw))
      } catch {
        /* abaikan */
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ success: true }))
    })
  })
  await new Promise<void>((r) => server.listen(9099, r))

  const ony = await prisma.user.findFirstOrThrow({ where: { isOwner: true } })
  const budi = await prisma.user.create({
    data: {
      name: "TEST Budi Sesi",
      email: "test-budi-sesi@example.invalid",
      phoneNumber: "081999000222",
      approvedAt: new Date(),
    },
  })
  const budiSession = sessionIdFor(budi.id)
  await prisma.user.update({ where: { id: budi.id }, data: { wahubSessionId: budiSession } })

  try {
    // 1. Ony mengirim ke nomor PRIBADI Budi — harus ditolak.
    const r1 = await handleWhatsappWebhook(payloadFrom(budiSession, ony.phoneNumber!, "## PENANDA nyasar"))
    check("pesan Ony ke sesi pribadi Budi ditolak", "skipped" in r1)

    // 2. Budi mengirim ke sesi pribadinya sendiri — harus dilayani, balasan lewat sesi itu juga.
    sent.length = 0
    const r2 = await handleWhatsappWebhook(payloadFrom(budiSession, "081999000222", "## PENANDA sesi budi"))
    check("pesan Budi ke sesi pribadinya dilayani", "handled" in r2)
    check("balasan dikirim lewat sesi pribadi Budi", sent.every((s) => s.sessionId === budiSession))

    // 3. Budi mengirim ke nomor Naya BERSAMA — tetap dilayani (sesi bersama melayani semua),
    //    dan balasannya keluar dari sesi bersama, bukan sesi pribadinya.
    sent.length = 0
    const r3 = await handleWhatsappWebhook(payloadFrom("default", "081999000222", "## PENANDA sesi bersama"))
    check("pesan Budi ke nomor bersama tetap dilayani", "handled" in r3)
    check("balasannya keluar dari sesi bersama", sent.every((s) => s.sessionId === "default"))

    // 4. Yang tersimpan harus masuk ke workspace Budi, bukan Ony.
    const budiMotivations = await prisma.motivationMessage.findMany({ where: { userId: budi.id } })
    const onyNyasar = await prisma.motivationMessage.findMany({
      where: { userId: ony.id, content: { contains: "PENANDA" } },
    })
    check("motivasi tersimpan di workspace Budi", budiMotivations.length === 2)
    check("tidak ada yang nyasar ke workspace Ony", onyNyasar.length === 0)
  } finally {
    await prisma.motivationMessage.deleteMany({ where: { userId: budi.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: budi.id } })
    await prisma.user.delete({ where: { id: budi.id } })
    server.close()
    console.log("\n(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
