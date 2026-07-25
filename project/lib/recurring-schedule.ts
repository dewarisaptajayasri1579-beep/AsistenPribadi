import { jakartaDateTime, jakartaIsoWeekday, jakartaTodayDateIso, shiftJakartaDateIso } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

export const RECURRING_HORIZON_WEEKS = 12

interface RecurringDefinition {
  id: string
  title: string
  weekdays: number[]
  startTime: string
  endTime: string | null
  location: string | null
  notes: string | null
}

async function hasConflict(userId: string, start: Date, end: Date) {
  const overlapping = await prisma.schedule.findMany({
    where: { userId, status: { not: "cancelled" }, startAt: { lt: end } },
  })
  return overlapping.some((s) => {
    const sEnd = s.endAt ?? new Date(s.startAt.getTime() + 60 * 60 * 1000)
    return s.startAt < end && sEnd > start
  })
}

/** Bikinkan baris Schedule asli untuk tiap kejadian dari fromDateIso sampai sebelum `until`,
 *  di hari-hari yang cocok dengan definisi rutinnya. Kejadian yang bentrok jadwal lain di-skip
 *  (bukan dibatalkan seluruhnya) supaya sisa rangkaian tetap terbuat. */
export async function materializeOccurrences(userId: string, recurring: RecurringDefinition, fromDateIso: string, until: Date) {
  const created: string[] = []
  const skipped: string[] = []
  const untilIso = jakartaTodayDateIso(until)

  let cursorIso = fromDateIso
  while (cursorIso < untilIso) {
    if (recurring.weekdays.includes(jakartaIsoWeekday(cursorIso))) {
      const startAt = jakartaDateTime(cursorIso, recurring.startTime)
      const endAt = recurring.endTime
        ? jakartaDateTime(cursorIso, recurring.endTime)
        : new Date(startAt.getTime() + 60 * 60 * 1000)

      if (await hasConflict(userId, startAt, endAt)) {
        skipped.push(cursorIso)
      } else {
        await prisma.schedule.create({
          data: {
            userId,
            title: recurring.title,
            startAt,
            endAt,
            location: recurring.location,
            notes: recurring.notes,
            recurrenceId: recurring.id,
          },
        })
        created.push(cursorIso)
      }
    }
    cursorIso = shiftJakartaDateIso(cursorIso, 1)
  }

  return { created, skipped }
}
