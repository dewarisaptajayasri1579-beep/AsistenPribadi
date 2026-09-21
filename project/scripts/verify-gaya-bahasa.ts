import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"

/** Naya berbicara kepada ATASAN: sopan, tapi tidak kaku seperti customer service.
 *
 *  Kata-kata di bawah ini bukan daftar selera — semuanya pernah benar-benar muncul, dan system
 *  prompt LAMA justru menyuruhnya begitu ("gaya gaul", dan larangan memakai "Baik, akan saya
 *  proses"). Jadi yang diuji di sini adalah apakah arahannya sudah benar-benar terbalik. */
const TERLARANG = [
  /\boke\b/i, /\bokay\b/i, /\bsip\b/i, /\bhmm+/i, /\bwaduh\b/i, /\bwah\b/i,
  /\bhehe\b/i, /\bwkwk\b/i, /\bwoy\b/i, /\bgaes\b/i, /~/,
  // Terlalu kaku ke arah sebaliknya: "Anda" bersamaan dengan sapaan terdengar seperti CS.
  /\bAnda\b/,
]

function periksa(label: string, teks: string) {
  const kena = TERLARANG.filter((r) => r.test(teks)).map((r) => String(r))
  const ok = kena.length === 0
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  console.log(`   "${teks.replace(/\n+/g, " ").slice(0, 110)}"`)
  if (!ok) {
    console.log(`   ditemukan: ${kena.join(", ")}`)
    process.exitCode = 1
  }
}

async function main() {
  const uji = await prisma.user.create({
    data: { name: "UJI Gaya", email: `gaya-${Date.now()}@example.invalid`, sapaan: "Pak Uji", approvedAt: new Date() },
  })

  try {
    const perintah = [
      ["menerima tugas", "catat ya, besok jam 9 pagi meeting dengan tim produksi"],
      ["menyampaikan kabar kosong", "tugasku hari ini apa saja?"],
      ["menghadapi permintaan tidak jelas", "tolong atur itu ya"],
      ["ditanya identitas", "kamu siapa sih?"],
    ] as const

    for (const [label, cmd] of perintah) {
      const { reply } = await runAgent({ ownerId: uji.id, actorId: uji.id, sapaan: "Pak Uji", command: cmd })
      periksa(label, reply)
    }
  } finally {
    await prisma.schedule.deleteMany({ where: { userId: uji.id } })
    await prisma.task.deleteMany({ where: { userId: uji.id } })
    await prisma.aiUsageLog.deleteMany({ where: { userId: uji.id } })
    await prisma.agentRun.deleteMany({ where: { userId: uji.id } })
    await prisma.whatsappThread.deleteMany({ where: { userId: uji.id } })
    await prisma.user.delete({ where: { id: uji.id } })
    console.log("\n(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
