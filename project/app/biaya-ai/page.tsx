import { AiUsagePage } from "@/components/ai-usage-page"
import { getCurrentUser, getWorkspaceOwnerFor } from "@/lib/current-user"
import { getAiUsageOverview, getAiUsagePerDirector } from "@/lib/usage-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()
  const owner = await getWorkspaceOwnerFor(user)

  // Rincian chat hanya untuk workspace sendiri. Rekap per direktur (angka saja) khusus admin.
  const [overview, perDirector] = await Promise.all([
    getAiUsageOverview(owner.id),
    user.isAdmin ? getAiUsagePerDirector() : Promise.resolve(undefined),
  ])

  return <AiUsagePage overview={overview} perDirector={perDirector} />
}
