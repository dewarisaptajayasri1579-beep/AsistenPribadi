import { ReportsPage } from "@/components/reports-page"
import { getWorkspaceOwner } from "@/lib/current-user"
import { getDailyReportData } from "@/lib/report-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const owner = await getWorkspaceOwner()
  const data = await getDailyReportData(owner.id)

  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date())

  return <ReportsPage data={data} todayLabel={todayLabel} />
}
