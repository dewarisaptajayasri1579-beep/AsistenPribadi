import { formatJakartaTime, jakartaTodayRange } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

export async function getDashboardData(userId: string) {
  const { start, end } = jakartaTodayRange()

  const [todaySchedules, undoneTasks, highPriorityTasks, doneTodayCount, overdueFollowUps, pendingFollowUps, delegasiTerbuka] =
    await Promise.all([
      prisma.schedule.findMany({
        where: { userId, startAt: { gte: start, lt: end }, status: { notIn: ["cancelled", "done"] } },
        orderBy: { startAt: "asc" },
      }),
      prisma.task.findMany({
        where: { userId, status: { notIn: ["done"] } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.task.findMany({
        where: { userId, priority: "high", status: { notIn: ["done"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      prisma.task.count({
        where: { userId, status: "done", completedAt: { gte: start, lt: end } },
      }),
      prisma.followUp.findMany({
        where: { userId, status: "open", dueDate: { lt: start } },
      }),
      // Follow-up terbuka tanpa tanggal (masih tunggu konfirmasi) — tidak pernah "overdue",
      // jadi dimunculkan terpisah supaya tidak diam-diam terlupakan.
      prisma.followUp.findMany({
        where: { userId, status: "open", dueDate: null },
      }),
      // Jenis pekerjaan keempat, selain tugas/jadwal/follow-up: yang dititipkan ke orang lain.
      prisma.delegation.findMany({
        where: { userId, status: "menunggu", optedOut: false },
        orderBy: { createdAt: "asc" },
      }),
    ])

  const agenda = todaySchedules.map((s) => ({
    time: formatJakartaTime(s.startAt),
    title: s.title,
    location: s.location ?? "-",
  }))

  const priorities = highPriorityTasks.map((t) => ({
    title: t.title,
    description: t.description ?? t.category ?? "",
    level: "Tinggi" as const,
  }))

  return {
    agenda,
    priorities,
    summary: {
      agendaCount: todaySchedules.length,
      undoneTasksCount: undoneTasks.length,
      highPriorityCount: highPriorityTasks.length,
    },
    report: {
      doneToday: doneTodayCount,
      undoneToday: undoneTasks.length,
      highPriority: highPriorityTasks.length,
      overdueFollowUps: overdueFollowUps.map((f) => f.title),
      pendingFollowUps: pendingFollowUps.map((f) => f.title),
      delegasi: delegasiTerbuka.map((d) => `${d.title} (${d.contactName})`),
    },
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
