import { getAllWorkspaceOwners } from "@/lib/current-user"
import { getOwnerRecipients } from "@/lib/cron/recipients"
import { sapaanOf } from "@/lib/sapaan"
import { getDailyReportData } from "@/lib/report-queries"
import { sendPushToUser } from "@/lib/push"
import { outgoingSessionId } from "@/lib/wa-session"
import { sendWhatsappMessage } from "@/lib/wahub"

export async function runEveningEvaluation() {
  // Sekali per direktur, tiap direktur diisolasi errornya — lihat morning-briefing.ts.
  for (const owner of await getAllWorkspaceOwners()) {
    try {
      await sendEveningEvaluationFor(owner.id)
    } catch (error) {
      console.error(`[cron] evaluasi malam gagal untuk ${owner.name}:`, error)
    }
  }
}

async function sendEveningEvaluationFor(ownerId: string) {
  // Sama seperti briefing pagi: penerima dulu, karena sapaannya dipakai di kalimat pembuka.
  const recipient = (await getOwnerRecipients([ownerId], "notifyDailyReport")).get(ownerId)
  if (!recipient) return

  const data = await getDailyReportData(ownerId)

  const lines = [`📋 Selamat malam ${sapaanOf(recipient)}, berikut evaluasi hari ini:`, ``]

  // Agenda dan tugas dilaporkan TERPISAH: sebagian besar pekerjaan harian tersimpan sebagai
  // jadwal, dan menggabungkannya membuat "0 dari 1 selesai" muncul di hari yang sebenarnya
  // produktif.
  if (data.stats.agendaCount > 0) {
    lines.push(`Agenda: ${data.stats.agendaSelesai} dari ${data.stats.agendaCount} sudah ditandai selesai.`)
  }

  if (data.stats.doneToday > 0 || data.stats.undoneTodayCount > 0) {
    lines.push(
      `Tugas: ${data.stats.doneToday} selesai hari ini, ${data.stats.undoneTodayCount} masih menunggu.`
    )
  }

  if (data.stats.agendaCount === 0 && data.stats.doneToday === 0 && data.stats.undoneTodayCount === 0) {
    lines.push("Tidak ada agenda maupun tugas yang jatuh tempo hari ini.")
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

  // Penutupnya ikut keadaan — "yang belum selesai bisa dilanjutkan besok" terdengar aneh di hari
  // yang justru semuanya tuntas.
  const adaTertunggak =
    data.stats.undoneTodayCount > 0 ||
    data.stats.agendaSelesai < data.stats.agendaCount ||
    data.overdueFollowUps.length > 0

  lines.push("")
  lines.push(
    adaTertunggak
      ? "Yang belum selesai bisa dilanjutkan besok. Selamat beristirahat."
      : "Semuanya tuntas hari ini. Selamat beristirahat."
  )

  const message = lines.join("\n")

  if (recipient.phoneNumber) {
    try {
      await sendWhatsappMessage(recipient.phoneNumber, message, outgoingSessionId(recipient))
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
