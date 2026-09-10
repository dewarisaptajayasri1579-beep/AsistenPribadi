import { SettingsPage } from "@/components/settings-page"
import { getCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()

  return (
    <SettingsPage
      admin={user.isAdmin ? { currentUserId: user.id } : undefined}
      isDirector={!user.ownerId}
      initial={{
        name: user.name,
        role: user.role,
        sapaan: user.sapaan ?? "",
        email: user.email,
        phoneNumber: user.phoneNumber ?? "",
        assistantInstructions: user.assistantInstructions ?? "",
        notifyAgenda: user.notifyAgenda,
        notifyDailyReport: user.notifyDailyReport,
        notifyPriorityAlert: user.notifyPriorityAlert,
        notifyMorningBriefing: user.notifyMorningBriefing,
        notifyStockMarket: user.notifyStockMarket,
        stockNotifyPhone1: user.stockNotifyPhone1 ?? "",
        stockNotifyPhone2: user.stockNotifyPhone2 ?? "",
      }}
    />
  )
}
