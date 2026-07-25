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

  const [daySchedules, tasks, followUps] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId: owner.id, startAt: { gte: start, lt: end }, status: { not: "cancelled" } },
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
      weekDays={jakartaCurrentWeek(parseJakartaDateIso(selectedDateIso))}
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
