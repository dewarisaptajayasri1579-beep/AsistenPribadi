import { jakartaTodayDateIso } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { materializeOccurrences } from "@/lib/recurring-schedule"

const TOP_UP_DAYS = 7

/** Geser horizonUntil tiap jadwal rutin aktif maju 1 minggu & bikinkan kejadian barunya —
 *  supaya rangkaian jadwal rutin tidak pernah "habis" walau app jalan terus-menerus. */
export async function runRecurringScheduleTopUp() {
  const active = await prisma.recurringSchedule.findMany({ where: { active: true } })

  for (const recurring of active) {
    const fromIso = jakartaTodayDateIso(recurring.horizonUntil)
    const newHorizon = new Date(recurring.horizonUntil.getTime() + TOP_UP_DAYS * 24 * 60 * 60 * 1000)

    try {
      await materializeOccurrences(recurring.userId, recurring, fromIso, newHorizon)
      await prisma.recurringSchedule.update({ where: { id: recurring.id }, data: { horizonUntil: newHorizon } })
    } catch (error) {
      console.error(`[cron] Gagal top-up jadwal rutin "${recurring.title}":`, error)
    }
  }
}
