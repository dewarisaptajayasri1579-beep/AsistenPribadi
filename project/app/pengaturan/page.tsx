import { SettingsPage } from "@/components/settings-page"
import { getCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()

  return (
    <SettingsPage
      initial={{
        name: user.name,
        role: user.role,
        email: user.email,
        phoneNumber: user.phoneNumber ?? "",
        assistantInstructions: user.assistantInstructions ?? "",
        notifyAgenda: user.notifyAgenda,
        notifyDailyReport: user.notifyDailyReport,
        notifyPriorityAlert: user.notifyPriorityAlert,
        notifyMorningBriefing: user.notifyMorningBriefing,
      }}
    />
  )
}
