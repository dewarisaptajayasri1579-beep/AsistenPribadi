import { jakartaTodayRange } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

/** Ringkasan biaya AI untuk seluruh workspace (semua user yang login & chat). */
export async function getAiUsageOverview() {
  const { start } = jakartaTodayRange()

  const [logs, todayAgg, allTimeAgg] = await Promise.all([
    prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { estimatedCostUsd: true, apiCallCount: true },
      _count: true,
    }),
    prisma.aiUsageLog.aggregate({
      _sum: { estimatedCostUsd: true, apiCallCount: true },
      _count: true,
    }),
  ])

  return {
    logs: logs.map((log) => ({
      id: log.id,
      userName: log.user.name,
      command: log.command,
      model: log.model,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      cacheReadTokens: log.cacheReadTokens,
      apiCallCount: log.apiCallCount,
      estimatedCostUsd: Number(log.estimatedCostUsd),
      durationMs: log.durationMs,
      createdAt: log.createdAt,
    })),
    today: {
      count: todayAgg._count,
      totalCostUsd: Number(todayAgg._sum.estimatedCostUsd ?? 0),
      totalApiCalls: todayAgg._sum.apiCallCount ?? 0,
    },
    allTime: {
      count: allTimeAgg._count,
      totalCostUsd: Number(allTimeAgg._sum.estimatedCostUsd ?? 0),
      totalApiCalls: allTimeAgg._sum.apiCallCount ?? 0,
    },
  }
}

export type AiUsageOverview = Awaited<ReturnType<typeof getAiUsageOverview>>
