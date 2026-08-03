import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getDailyReportData } from "@/lib/report-queries"
import { sendPushToUser } from "@/lib/push"
import { sendWhatsappMessage } from "@/lib/wahub"

export async function runEveningEvaluation() {
  const owner = await getWorkspaceOwner()
  const data = await getDailyReportData(owner.id)

  const total = data.stats.doneToday + data.stats.undoneCount
  const lines = [
    `📋 Malem Mas Ony~ evaluasi hari ini nih dari Naya:`,
    ``,
    total === 0
      ? "Gak ada tugas tercatat hari ini~"
      : `Dari ${total} tugas hari ini: ${data.stats.doneToday} udah kelar, ${data.stats.undoneCount} masih belum.`,
  ]

  if (data.stats.highPriorityCount > 0) {
    lines.push(`Masih ada ${data.stats.highPriorityCount} tugas prioritas tinggi yang belum kelar lho~`)
  }

  if (data.overdueFollowUps.length > 0) {
    lines.push("")
    lines.push("Follow-up terlambat:")
    data.overdueFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  if (data.pendingFollowUps.length > 0) {
    lines.push("")
    lines.push("Menunggu konfirmasi tanggal:")
    data.pendingFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  lines.push("")
  lines.push("Yang belum kelar bisa dilanjut besok ya, tinggal cek menu Jadwal & Tugas aja~")

  const message = lines.join("\n")

  const recipients = await prisma.user.findMany({
    where: { notifyDailyReport: true },
  })

  for (const recipient of recipients) {
    if (recipient.phoneNumber) {
      try {
        await sendWhatsappMessage(recipient.phoneNumber, message)
      } catch (error) {
        console.error(`[cron] Gagal kirim evaluasi malam WA ke ${recipient.name}:`, error)
      }
    }
    try {
      await sendPushToUser(recipient.id, { title: "📋 Evaluasi Malam", body: message, url: "/laporan" })
    } catch (error) {
      console.error(`[cron] Gagal kirim evaluasi malam push ke ${recipient.name}:`, error)
    }
  }
}
