import { formatJakartaTime, jakartaTodayRange } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

function scheduleStatus(startAt: Date, endAt: Date | null, now: Date) {
  const end = endAt ?? new Date(startAt.getTime() + 60 * 60 * 1000)
  if (now < startAt) return "Akan Datang"
  if (now > end) return "Selesai"
  return "Berjalan"
}

export async function getDailyReportData(userId: string) {
  const now = new Date()
  const { start, end } = jakartaTodayRange(now)
  const tomorrowStart = end
  const tomorrowEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000)

  const [
    todaySchedules,
    doneTaskList,
    undoneTasks,
    highPriorityTasks,
    overdueFollowUps,
    pendingFollowUps,
    tomorrowSchedules,
    delegasiTerbuka,
  ] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId, startAt: { gte: start, lt: end }, status: { not: "cancelled" } },
      orderBy: { startAt: "asc" },
    }),
    prisma.task.findMany({ where: { userId, status: "done", completedAt: { gte: start, lt: end } }, orderBy: { completedAt: "asc" } }),
    prisma.task.findMany({ where: { userId, status: { notIn: ["done"] } }, orderBy: { dueDate: "asc" } }),
    prisma.task.findMany({
      where: { userId, priority: "high", status: { notIn: ["done"] } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.followUp.findMany({ where: { userId, status: "open", dueDate: { lt: start } } }),
    // Follow-up terbuka tanpa tanggal (mis. masih tunggu konfirmasi pihak lain) — tidak pernah
    // "overdue" karena tidak ada dueDate, jadi harus dimunculkan terpisah supaya tidak terlupakan.
    prisma.followUp.findMany({ where: { userId, status: "open", dueDate: null } }),
    prisma.schedule.findMany({
      where: { userId, startAt: { gte: tomorrowStart, lt: tomorrowEnd }, status: { not: "cancelled" } },
      orderBy: { startAt: "asc" },
    }),
    // Pekerjaan yang dititipkan ke orang lain. Ini jenis pekerjaan KEEMPAT (selain tugas, jadwal,
    // dan follow-up) dan sebelumnya tidak pernah masuk laporan manapun — direktur yang menitipkan
    // pekerjaan tidak akan pernah melihatnya lagi di briefing atau evaluasi.
    prisma.delegation.findMany({
      where: { userId, status: "menunggu", optedOut: false },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const activities = todaySchedules.map((s) => ({
    id: s.id,
    time: formatJakartaTime(s.startAt),
    title: s.title,
    status: scheduleStatus(s.startAt, s.endAt, now),
  }))

  // Agenda hari ini yang sudah/belum ditandai selesai. Sebelumnya evaluasi malam sama sekali
  // tidak menghitung jadwal — padahal sebagian besar pekerjaan harian tersimpan sebagai JADWAL,
  // bukan Task. Akibatnya direktur yang menyelesaikan agendanya tetap dilaporkan "0 selesai".
  const agendaSelesai = todaySchedules.filter((s) => s.status === "done").length

  // Tugas yang relevan untuk HARI INI saja: jatuh tempo hari ini atau sudah terlambat. Tanpa
  // batas ini, tugas yang deadline-nya minggu depan ikut dilaporkan sebagai "belum selesai hari
  // ini" — membuat laporan terasa salah padahal tidak ada yang tertunggak.
  const undoneTodayCount = undoneTasks.filter((t) => t.dueDate && t.dueDate < end).length

  return {
    stats: {
      agendaCount: todaySchedules.length,
      agendaSelesai,
      doneToday: doneTaskList.length,
      undoneCount: undoneTasks.length,
      undoneTodayCount,
      highPriorityCount: highPriorityTasks.length,
    },
    activities,
    // Judulnya ikut dibawa, bukan cuma jumlahnya — laporan yang hanya menyebut angka membuat
    // pembacanya harus menebak item mana yang dimaksud.
    agendaSelesaiList: todaySchedules.filter((s) => s.status === "done").map((s) => s.title),
    agendaBelumList: todaySchedules.filter((s) => s.status !== "done").map((s) => s.title),
    tugasSelesaiList: doneTaskList.map((t) => t.title),
    tugasBelumList: undoneTasks.filter((t) => t.dueDate && t.dueDate < end).map((t) => t.title),
    delegasi: delegasiTerbuka.map((d) => `${d.title} (${d.contactName})`),
    overdueFollowUps: overdueFollowUps.map((f) => f.title),
    pendingFollowUps: pendingFollowUps.map((f) => f.title),
    tomorrowFocus: {
      schedules: tomorrowSchedules.map((s) => ({ time: formatJakartaTime(s.startAt), title: s.title })),
      highPriorityTasks: highPriorityTasks.slice(0, 5).map((t) => t.title),
    },
  }
}

export type DailyReportData = Awaited<ReturnType<typeof getDailyReportData>>
