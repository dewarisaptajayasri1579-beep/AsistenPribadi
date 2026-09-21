import { formatJakartaDateLabel, jakartaTodayDateIso, jakartaTodayRange } from "@/lib/datetime"
import { getAllWorkspaceOwners } from "@/lib/current-user"
import { getOwnerRecipients } from "@/lib/cron/recipients"
import { sapaanOf } from "@/lib/sapaan"
import { getDashboardData } from "@/lib/dashboard-queries"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push"
import { outgoingSessionId } from "@/lib/wa-session"
import { sendWhatsappMessage } from "@/lib/wahub"

// Tugas multi-hari (rentang startDate–dueDate > 1 hari) yang sedang berjalan hari ini —
// diingatkan tiap pagi sampai ditandai selesai lewat chat AI Assistant.
async function getOngoingMultiDayTasks(userId: string) {
  const { start, end } = jakartaTodayRange()

  const candidates = await prisma.task.findMany({
    where: {
      userId,
      status: { notIn: ["done"] },
      startDate: { not: null, lte: end },
      dueDate: { not: null, gte: start },
    },
    orderBy: { dueDate: "asc" },
  })

  return candidates.filter((t) => {
    const span = t.dueDate!.getTime() - t.startDate!.getTime()
    return span > 24 * 60 * 60 * 1000
  })
}

export async function runMorningBriefing() {
  // Sekali per direktur. Dibungkus try/catch masing-masing supaya satu direktur yang gagal
  // (mis. nomor WA-nya bermasalah) tidak menghentikan briefing direktur lain.
  for (const owner of await getAllWorkspaceOwners()) {
    try {
      await sendMorningBriefingFor(owner.id)
    } catch (error) {
      console.error(`[cron] briefing pagi gagal untuk ${owner.name}:`, error)
    }
  }
}

async function sendMorningBriefingFor(ownerId: string) {
  // Penerima diambil DULU: sapaannya dipakai menyusun pesan, dan kalau dia mematikan briefing
  // pagi kita tidak perlu repot menghitung agenda & tugasnya sama sekali.
  const recipient = (await getOwnerRecipients([ownerId], "notifyMorningBriefing")).get(ownerId)
  if (!recipient) return

  const sapaan = sapaanOf(recipient)
  const data = await getDashboardData(ownerId)
  const ongoingTasks = await getOngoingMultiDayTasks(ownerId)

  const lines = [`Selamat pagi ${sapaan} ☀️ Berikut agenda hari ini:`, ``]

  if (data.agenda.length === 0) {
    lines.push("Agenda: kosong hari ini.")
  } else {
    lines.push("Agenda:")
    for (const item of data.agenda) {
      lines.push(`- ${item.time} ${item.title}${item.location !== "-" ? ` (${item.location})` : ""}`)
    }
  }

  lines.push("")
  if (data.priorities.length === 0) {
    lines.push("Prioritas: tidak ada yang mendesak hari ini.")
  } else {
    lines.push("Prioritas:")
    data.priorities.forEach((p, i) => lines.push(`${i + 1}. ${p.title}`))
  }

  if (ongoingTasks.length > 0) {
    lines.push("")
    lines.push("Tugas sedang berjalan:")
    ongoingTasks.forEach((t) =>
      lines.push(`- ${t.title} (target selesai ${formatJakartaDateLabel(jakartaTodayDateIso(t.dueDate!))})`)
    )
  }

  if (data.report.overdueFollowUps.length > 0) {
    lines.push("")
    lines.push("Follow-up terlambat:")
    data.report.overdueFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  if (data.report.pendingFollowUps.length > 0) {
    lines.push("")
    lines.push("Menunggu konfirmasi tanggal:")
    data.report.pendingFollowUps.forEach((f) => lines.push(`- ${f}`))
  }

  lines.push("")
  lines.push(`Selamat beraktivitas, ${sapaan}.`)

  const message = lines.join("\n")

  if (recipient.phoneNumber) {
    try {
      await sendWhatsappMessage(recipient.phoneNumber, message, outgoingSessionId(recipient))
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
