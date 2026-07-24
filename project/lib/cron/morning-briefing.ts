import { getWorkspaceOwner } from "@/lib/current-user"
import { getDashboardData } from "@/lib/dashboard-queries"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push"
import { sendWhatsappMessage } from "@/lib/wahub"

export async function runMorningBriefing() {
  const owner = await getWorkspaceOwner()
  const data = await getDashboardData(owner.id)

  const lines = [`Selamat pagi! Berikut ringkasan hari ini:`, ``]

  if (data.agenda.length === 0) {
    lines.push("Agenda: tidak ada jadwal hari ini.")
  } else {
    lines.push("Agenda:")
    for (const item of data.agenda) {
      lines.push(`- ${item.time} ${item.title}${item.location !== "-" ? ` (${item.location})` : ""}`)
    }
  }

  lines.push("")
  if (data.priorities.length === 0) {
    lines.push("Prioritas: tidak ada tugas prioritas tinggi.")
  } else {
    lines.push("Prioritas:")
    data.priorities.forEach((p, i) => lines.push(`${i + 1}. ${p.title}`))
  }

  if (data.report.overdueFollowUps.length > 0) {
    lines.push("")
    lines.push("Follow-up terlambat:")
    data.report.overdueFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  const message = lines.join("\n")

  const recipients = await prisma.user.findMany({
    where: { notifyMorningBriefing: true },
  })

  for (const recipient of recipients) {
    if (recipient.phoneNumber) {
      try {
        await sendWhatsappMessage(recipient.phoneNumber, message)
      } catch (error) {
        console.error(`[cron] Gagal kirim briefing pagi WA ke ${recipient.name}:`, error)
      }
    }
    try {
      await sendPushToUser(recipient.id, { title: "Briefing Pagi", body: message, url: "/" })
    } catch (error) {
      console.error(`[cron] Gagal kirim briefing pagi push ke ${recipient.name}:`, error)
    }
  }
}
