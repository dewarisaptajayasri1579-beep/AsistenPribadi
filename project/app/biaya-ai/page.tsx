import { AiUsagePage } from "@/components/ai-usage-page"
import { getAiUsageOverview } from "@/lib/usage-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const overview = await getAiUsageOverview()

  return <AiUsagePage overview={overview} />
}
