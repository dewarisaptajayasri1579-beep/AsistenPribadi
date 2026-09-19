import { createServer } from "node:http"

import { runTool } from "../lib/agent-tools"
import { runDelegationReminders } from "../lib/cron/delegation-reminders"
import { prisma } from "../lib/prisma"
import { handleWhatsappWebhook } from "../lib/whatsapp-webhook"

/** Lingkaran penuh delegasi: direktur menitipkan -> penerima dikabari -> diingatkan 2x sehari ->
 *  penerima bilang selesai -> direktur dilapori. Penerimanya BUKAN pengguna terdaftar, jadi yang
 *  paling penting diuji adalah batas aksesnya: dia hanya boleh menjawab soal pekerjaannya sendiri. */
const terkirim: { number: string; message: string }[] = []
const CLIENT = "02c04786-e09f-41bc-82bd-6c4615f8eb2a"

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}
const ke = (n: string) => terkirim.filter((t) => t.number === n)

function pesanDari(nomor: string, teks: string) {
  return {
    sessionId: `${CLIENT}-default`,
    message: { from: `${nomor}@s.whatsapp.net`, senderNumber: nomor, to: "me", body: teks },
  }
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

  const direktur = await prisma.user.create({
    data: { name: "UJI Direktur", email: `d-${Date.now()}@example.invalid`, phoneNumber: "081900111222",
            sapaan: "Pak Uji", approvedAt: new Date() },
  })
  const NOVI = "6281900333444"

  try {
    // 1. Direktur menitipkan pekerjaan.
    const hasil: any = await runTool("delegate_task", {
      contactName: "Novi", contactPhone: "081900333444", title: "Siapkan draft MOU Tamsarnas",
    }, { userId: direktur.id })

    check("delegasi tersimpan", hasil.created === true)
    check("penerima langsung dikabari", ke(NOVI).length === 1)
    check("pesan perkenalan menyebut pengirim & cara berhenti",
      ke(NOVI)[0].message.includes("Pak Uji") && ke(NOVI)[0].message.includes("STOP"))

    // 2. Nomor asing yang TIDAK dititipi apapun tetap didiamkan.
    const asing = await handleWhatsappWebhook(pesanDari("6281999888777", "halo, buatkan saya jadwal besok"))
    check("nomor asing tanpa delegasi tetap didiamkan", "skipped" in asing)

    // 3. Penerima balas "belum" -> tidak menutup apapun.
    terkirim.length = 0
    await handleWhatsappWebhook(pesanDari(NOVI, "belum, besok ya"))
    const masihMenunggu = await prisma.delegation.findFirstOrThrow({ where: { userId: direktur.id } })
    check("balasan 'belum' tidak menutup pekerjaan", masihMenunggu.status === "menunggu")
    check("balasan 'belum' tidak mengganggu direktur", ke("6281900111222").length === 0)

    // 4. Pengingat 2x sehari, tapi tidak dobel dalam satu slot.
    terkirim.length = 0
    await runDelegationReminders()
    await runDelegationReminders()
    check("cron mengingatkan sekali, tidak dobel", ke(NOVI).length === 1)

    // 5. Penerima bilang selesai -> direktur dilapori.
    terkirim.length = 0
    await handleWhatsappWebhook(pesanDari(NOVI, "sudah"))
    const selesai = await prisma.delegation.findFirstOrThrow({ where: { userId: direktur.id } })
    check("pekerjaan ditandai selesai", selesai.status === "selesai")
    check("DIREKTUR dilapori", ke("6281900111222").some((t) => t.message.includes("sudah selesai")))
    check("penerima diberi konfirmasi", ke(NOVI).length === 1)

    // 6. Sesudah selesai, nomor itu kembali jadi orang asing.
    terkirim.length = 0
    const sesudah = await handleWhatsappWebhook(pesanDari(NOVI, "halo, tugasku apa lagi?"))
    check("setelah selesai, nomornya didiamkan lagi", "skipped" in sesudah)

    // 7. STOP menghentikan selamanya, dan delegasi baru ke nomor itu ditolak.
    const d2: any = await runTool("delegate_task", { contactName: "Novi", title: "Pekerjaan kedua" }, { userId: direktur.id })
    check("delegasi ulang tanpa nomor memakai nomor tersimpan", d2.created === true)
    terkirim.length = 0
    await handleWhatsappWebhook(pesanDari(NOVI, "STOP"))
    const d3: any = await runTool("delegate_task", { contactName: "Novi", title: "Pekerjaan ketiga" }, { userId: direktur.id })
    check("setelah STOP, delegasi baru ditolak", d3.created === false)
  } finally {
    await prisma.delegation.deleteMany({ where: { userId: direktur.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: direktur.id } })
    await prisma.user.delete({ where: { id: direktur.id } })
    server.close()
    console.log("(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
