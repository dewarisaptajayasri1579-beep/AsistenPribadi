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

  const [todaySchedules, doneToday, undoneTasks, highPriorityTasks, overdueFollowUps, tomorrowSchedules] =
    await Promise.all([
      prisma.schedule.findMany({
        where: { userId, startAt: { gte: start, lt: end }, status: { not: "cancelled" } },
        orderBy: { startAt: "asc" },
      }),
      prisma.task.count({ where: { userId, status: "done", completedAt: { gte: start, lt: end } } }),
      prisma.task.findMany({ where: { userId, status: { notIn: ["done"] } }, orderBy: { dueDate: "asc" } }),
      prisma.task.findMany({
        where: { userId, priority: "high", status: { notIn: ["done"] } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.followUp.findMany({ where: { userId, status: "open", dueDate: { lt: start } } }),
      prisma.schedule.findMany({
        where: { userId, startAt: { gte: tomorrowStart, lt: tomorrowEnd }, status: { not: "cancelled" } },
        orderBy: { startAt: "asc" },
      }),
    ])

  const activities = todaySchedules.map((s) => ({
    id: s.id,
    time: formatJakartaTime(s.startAt),
    title: s.title,
    status: scheduleStatus(s.startAt, s.endAt, now),
  }))

  return {
    stats: {
      agendaCount: todaySchedules.length,
      doneToday,
      undoneCount: undoneTasks.length,
      highPriorityCount: highPriorityTasks.length,
    },
    activities,
    overdueFollowUps: overdueFollowUps.map((f) => f.title),
    tomorrowFocus: {
      schedules: tomorrowSchedules.map((s) => ({ time: formatJakartaTime(s.startAt), title: s.title })),
      highPriorityTasks: highPriorityTasks.slice(0, 5).map((t) => t.title),
    },
  }
}

export type DailyReportData = Awaited<ReturnType<typeof getDailyReportData>>
