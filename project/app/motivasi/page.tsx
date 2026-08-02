import { MotivationPage } from "@/components/motivation-page"
import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Page() {
  const owner = await getWorkspaceOwner()
  const motivations = await prisma.motivationMessage.findMany({
    where: { userId: owner.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <MotivationPage
      initial={motivations.map((m) => ({
        id: m.id,
        label: m.label,
        content: m.content,
        active: m.active,
        source: m.source,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  )
}
