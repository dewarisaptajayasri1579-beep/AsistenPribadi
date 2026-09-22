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

  const lines = [`📋 Selamat malam ${sapaanOf(recipient)}, berikut evaluasi hari ini:`]

  // Disebutkan satu per satu, bukan cuma jumlahnya: laporan berupa angka saja membuat
  // pembacanya harus menebak item mana yang dimaksud — dan itulah yang bikin laporan terasa
  // salah walau angkanya benar.
  const daftar = (judul: string, items: string[]) => {
    if (items.length === 0) return
    lines.push(``)
    lines.push(judul)
    items.forEach((t) => lines.push(`- ${t}`))
  }

  daftar(`Agenda selesai (${data.agendaSelesaiList.length}):`, data.agendaSelesaiList)
  daftar(`Agenda belum ditandai selesai (${data.agendaBelumList.length}):`, data.agendaBelumList)
  daftar(`Tugas selesai hari ini (${data.tugasSelesaiList.length}):`, data.tugasSelesaiList)
  daftar(`Tugas yang masih menunggu (${data.tugasBelumList.length}):`, data.tugasBelumList)
  daftar(`Dititipkan ke orang lain, belum ada kabar (${data.delegasi.length}):`, data.delegasi)

  const adaIsi =
    data.agendaSelesaiList.length + data.agendaBelumList.length +
    data.tugasSelesaiList.length + data.tugasBelumList.length + data.delegasi.length > 0
  if (!adaIsi) lines.push("Tidak ada agenda maupun tugas yang jatuh tempo hari ini.")

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
    data.tugasBelumList.length > 0 ||
    data.agendaBelumList.length > 0 ||
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
