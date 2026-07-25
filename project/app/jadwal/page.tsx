import { SchedulePage } from "@/components/schedule-page"
import { getWorkspaceOwner } from "@/lib/current-user"
import {
  formatJakartaDateLabel,
  formatJakartaTime,
  jakartaCurrentWeek,
  jakartaTodayDateIso,
  jakartaTodayRange,
  parseJakartaDateIso,
  shiftJakartaDateIso,
} from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const owner = await getWorkspaceOwner()
  const params = await searchParams
  const todayIso = jakartaTodayDateIso()
  const selectedDateIso = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayIso

  const { start, end } = jakartaTodayRange(parseJakartaDateIso(selectedDateIso))
  const weekDays = jakartaCurrentWeek(parseJakartaDateIso(selectedDateIso))
  const weekStart = jakartaTodayRange(parseJakartaDateIso(weekDays[0].iso)).start
  const weekEnd = jakartaTodayRange(parseJakartaDateIso(weekDays[6].iso)).end

  const [daySchedules, weekSchedules, tasks, followUps] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId: owner.id, startAt: { gte: start, lt: end }, status: { not: "cancelled" } },
      orderBy: { startAt: "asc" },
    }),
    prisma.schedule.findMany({
      where: { userId: owner.id, startAt: { gte: weekStart, lt: weekEnd }, status: { not: "cancelled" } },
      orderBy: { startAt: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: owner.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.followUp.findMany({
      where: { userId: owner.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
  ])

  const agenda = daySchedules.map((s) => ({
    id: s.id,
    time: formatJakartaTime(s.startAt),
    title: s.title,
    location: s.location ?? "-",
  }))

  const weekItems = [
    ...weekSchedules.map((s) => ({
      id: s.id,
      title: s.title,
      type: "jadwal" as const,
      priority: null,
      dateIso: jakartaTodayDateIso(s.startAt),
      dateLabel: formatJakartaDateLabel(jakartaTodayDateIso(s.startAt)),
      time: formatJakartaTime(s.startAt),
    })),
    ...tasks
      .filter((t) => t.dueDate && t.dueDate >= weekStart && t.dueDate < weekEnd)
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: "tugas" as const,
        priority: t.priority,
        dateIso: jakartaTodayDateIso(t.dueDate!),
        dateLabel: formatJakartaDateLabel(jakartaTodayDateIso(t.dueDate!)),
        time: null,
      })),
  ].sort((a, b) => a.dateIso.localeCompare(b.dateIso) || (a.time ?? "").localeCompare(b.time ?? ""))

  return (
    <SchedulePage
      agenda={agenda}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        startDate: t.startDate ? formatJakartaDateLabel(jakartaTodayDateIso(t.startDate)) : null,
        dueDate: t.dueDate ? formatJakartaDateLabel(jakartaTodayDateIso(t.dueDate)) : null,
      }))}
      followUps={followUps.map((f) => ({
        id: f.id,
        title: f.title,
        relatedPerson: f.relatedPerson,
        notes: f.notes,
        status: f.status,
        dueDate: f.dueDate ? formatJakartaDateLabel(jakartaTodayDateIso(f.dueDate)) : null,
      }))}
      weekItems={weekItems}
      weekDays={weekDays}
      selectedDateIso={selectedDateIso}
      selectedDateLabel={formatJakartaDateLabel(selectedDateIso)}
      prevDateIso={shiftJakartaDateIso(selectedDateIso, -1)}
      nextDateIso={shiftJakartaDateIso(selectedDateIso, 1)}
      prevWeekDateIso={shiftJakartaDateIso(selectedDateIso, -7)}
      nextWeekDateIso={shiftJakartaDateIso(selectedDateIso, 7)}
      todayDateIso={todayIso}
      isToday={selectedDateIso === todayIso}
    />
  )
}
