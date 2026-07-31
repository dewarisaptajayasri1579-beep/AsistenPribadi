import { prisma } from "@/lib/prisma"

const HISTORY_LIMIT = 20

export async function getStockWatchesOverview(userId: string) {
  const watches = await prisma.stockWatch.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    include: {
      priceLogs: { orderBy: { checkedAt: "desc" }, take: HISTORY_LIMIT },
    },
  })

  return {
    watches: watches.map((w) => ({
      id: w.id,
      ticker: w.ticker,
      companyName: w.companyName,
      targetPrice: w.targetPrice,
      buyPrice: w.buyPrice,
      targetPercent: w.targetPercent,
      lastAlertAt: w.lastAlertAt,
      latestPrice: w.priceLogs[0]?.price ?? null,
      latestCheckedAt: w.priceLogs[0]?.checkedAt ?? null,
      history: w.priceLogs.map((log) => ({ price: log.price, checkedAt: log.checkedAt })),
    })),
  }
}

export type StockWatchesOverview = Awaited<ReturnType<typeof getStockWatchesOverview>>
