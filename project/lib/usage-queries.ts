import { jakartaTodayRange } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

/** Semua user yang datanya masuk hitungan satu workspace: direkturnya sendiri + anggota timnya.
 *  aiUsageLog.userId berisi id PELAKU yang mengetik (actor), bukan pemilik workspace — jadi biaya
 *  yang dikeluarkan sekretaris tetap harus muncul di tagihan direkturnya. */
async function workspaceMemberIds(ownerId: string) {
  const members = await prisma.user.findMany({ where: { ownerId }, select: { id: true } })
  return [ownerId, ...members.map((m) => m.id)]
}

/** Ringkasan biaya AI untuk SATU workspace.
 *
 *  Dulu fungsi ini query tanpa `where` sama sekali sehingga menampilkan log semua direktur
 *  digabung — termasuk kolom `command`, yang isinya teks perintah WhatsApp mereka apa adanya.
 *  Halaman ini satu-satunya yang tidak memanggil getWorkspaceOwner(), jadi ikut terlewat waktu
 *  workspace multi-direktur dipasang. */
export async function getAiUsageOverview(ownerId: string) {
  const { start } = jakartaTodayRange()
  const userIds = await workspaceMemberIds(ownerId)
  const scope = { userId: { in: userIds } }

  const [logs, todayAgg, allTimeAgg] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.aiUsageLog.aggregate({
      where: { ...scope, createdAt: { gte: start } },
      _sum: { estimatedCostUsd: true, apiCallCount: true },
      _count: true,
    }),
    prisma.aiUsageLog.aggregate({
      where: scope,
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

/** Rekap biaya PER DIREKTUR untuk admin — supaya pemakaian tiap orang bisa ditagihkan terpisah.
 *
 *  Sengaja hanya angka: jumlah permintaan & biaya. TIDAK ada `command`, judul, atau isi apapun —
 *  admin mengurus tagihan, bukan membaca percakapan direktur lain. */
export async function getAiUsagePerDirector() {
  const { start } = jakartaTodayRange()

  const [users, allTime, today] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, ownerId: true } }),
    prisma.aiUsageLog.groupBy({
      by: ["userId"],
      _sum: { estimatedCostUsd: true, apiCallCount: true },
      _count: true,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start } },
      _sum: { estimatedCostUsd: true },
      _count: true,
    }),
  ])

  // Pemakaian anggota tim digulung ke direkturnya (ownerId), bukan berdiri sendiri.
  const ownerOf = new Map(users.map((u) => [u.id, u.ownerId ?? u.id]))
  const rows = new Map<string, { name: string; count: number; costUsd: number; apiCalls: number; todayCount: number; todayCostUsd: number }>()

  for (const u of users) {
    if (u.ownerId) continue
    rows.set(u.id, { name: u.name, count: 0, costUsd: 0, apiCalls: 0, todayCount: 0, todayCostUsd: 0 })
  }

  for (const g of allTime) {
    const row = rows.get(ownerOf.get(g.userId) ?? g.userId)
    if (!row) continue
    row.count += g._count
    row.costUsd += Number(g._sum.estimatedCostUsd ?? 0)
    row.apiCalls += g._sum.apiCallCount ?? 0
  }

  for (const g of today) {
    const row = rows.get(ownerOf.get(g.userId) ?? g.userId)
    if (!row) continue
    row.todayCount += g._count
    row.todayCostUsd += Number(g._sum.estimatedCostUsd ?? 0)
  }

  return [...rows.values()].sort((a, b) => b.costUsd - a.costUsd)
}

export type AiUsageOverview = Awaited<ReturnType<typeof getAiUsageOverview>>
export type AiUsagePerDirector = Awaited<ReturnType<typeof getAiUsagePerDirector>>
