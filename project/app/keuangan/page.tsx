import { FinancePage } from "@/components/finance-page"
import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Page() {
  const owner = await getWorkspaceOwner()
  const transactions = await prisma.transaction.findMany({
    where: { userId: owner.id },
    orderBy: { occurredAt: "desc" },
  })

  return (
    <FinancePage
      initial={transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        occurredAt: t.occurredAt.toISOString(),
        source: t.source,
      }))}
    />
  )
}
