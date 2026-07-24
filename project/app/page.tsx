import { DirectorDashboard } from "@/components/director-dashboard"
import { getCurrentUser, getWorkspaceOwner } from "@/lib/current-user"
import { getDashboardData } from "@/lib/dashboard-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()
  const owner = await getWorkspaceOwner()
  const data = await getDashboardData(owner.id)

  return <DirectorDashboard userName={user.name} data={data} />
}
