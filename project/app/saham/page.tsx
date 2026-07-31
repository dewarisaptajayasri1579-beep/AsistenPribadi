import { StockWatchPage } from "@/components/stock-watch-page"
import { getWorkspaceOwner } from "@/lib/current-user"
import { getStockWatchesOverview } from "@/lib/stock-queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const owner = await getWorkspaceOwner()
  const overview = await getStockWatchesOverview(owner.id)

  return <StockWatchPage initial={overview} />
}
