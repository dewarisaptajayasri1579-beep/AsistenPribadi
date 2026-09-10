import { runAgent } from "../lib/agent"
import { prisma } from "../lib/prisma"

/** Pastikan Naya memanggil lawan bicaranya sesuai kolom sapaan, bukan "Mas Ony" yang dulu
 *  ditulis langsung di system prompt. */
async function main() {
  const ony = await prisma.user.findFirstOrThrow({ where: { isOwner: true } })

  for (const sapaan of ["Mas Ony", "Pak Budi"]) {
    const { reply } = await runAgent({
      ownerId: ony.id,
      actorId: ony.id,
      command: "halo, kenalan dong. kamu siapa dan aku siapa?",
      sapaan,
    })

    const ok = reply.includes(sapaan)
    console.log(`${ok ? "✅" : "❌"} sapaan "${sapaan}" dipakai di balasan`)
    console.log(`   > ${reply.replace(/\n+/g, " ").slice(0, 160)}\n`)
    if (!ok) process.exitCode = 1
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
