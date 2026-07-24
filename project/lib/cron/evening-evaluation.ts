import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getDailyReportData } from "@/lib/report-queries"
import { sendWhatsappMessage } from "@/lib/wahub"

export async function runEveningEvaluation() {
  const owner = await getWorkspaceOwner()
  const data = await getDailyReportData(owner.id)

  const total = data.stats.doneToday + data.stats.undoneCount
  const lines = [
    `📋 Evaluasi Malam`,
    ``,
    total === 0
      ? "Tidak ada tugas yang tercatat untuk hari ini."
      : `Dari ${total} tugas hari ini: ${data.stats.doneToday} selesai, ${data.stats.undoneCount} belum selesai.`,
  ]

  if (data.stats.highPriorityCount > 0) {
    lines.push(`Masih ada ${data.stats.highPriorityCount} tugas prioritas tinggi yang belum selesai.`)
  }

  if (data.overdueFollowUps.length > 0) {
    lines.push("")
    lines.push("Follow-up terlambat:")
    data.overdueFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  lines.push("")
  lines.push("Tugas yang belum selesai otomatis bisa dilanjutkan besok — cek menu Jadwal & Tugas.")

  const message = lines.join("\n")

  const recipients = await prisma.user.findMany({
    where: { notifyDailyReport: true, phoneNumber: { not: null } },
  })

  for (const recipient of recipients) {
    if (!recipient.phoneNumber) continue
    try {
      await sendWhatsappMessage(recipient.phoneNumber, message)
    } catch (error) {
      console.error(`[cron] Gagal kirim evaluasi malam ke ${recipient.name}:`, error)
    }
  }
}
