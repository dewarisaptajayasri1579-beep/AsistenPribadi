import { AiUsagePage } from "@/components/ai-usage-page"
import { getCurrentUser } from "@/lib/current-user"
import { getAiUsageOverview } from "@/lib/usage-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()
  const overview = await getAiUsageOverview(user.id)

  return <AiUsagePage overview={overview} />
}
