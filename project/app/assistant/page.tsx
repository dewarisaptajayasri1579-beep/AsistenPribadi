import { AssistantPage } from "@/components/assistant-page"
import { getCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()
  return <AssistantPage userName={user.name} />
}
