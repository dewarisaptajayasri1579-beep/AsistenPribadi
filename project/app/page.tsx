import { DirectorDashboard } from "@/components/director-dashboard"
import { getCurrentUser } from "@/lib/current-user"
import { getDashboardData } from "@/lib/dashboard-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()
  const data = await getDashboardData(user.id)

  return <DirectorDashboard userName={user.name} data={data} />
}
