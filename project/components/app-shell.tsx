"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { DirectorSidebar } from "@/components/director-sidebar"
import { FloatingAiAssistant } from "@/components/floating-ai-assistant"

const PAGES_WITH_FULL_CHAT = ["/", "/assistant"]

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const pathname = usePathname()
  const hasFullChatOnPage = PAGES_WITH_FULL_CHAT.includes(pathname)

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setUserName(data.name)
        if (data?.role) setUserRole(data.role)
      })
      .catch(() => {})
  }, [])

  return (
    <main className="min-h-dvh overflow-x-hidden bg-background p-3 sm:p-5 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-5">
        <DirectorSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          userName={userName}
          userRole={userRole}
        />
        <div className="min-w-0 flex-1 lg:py-4">{children}</div>
      </div>
      {!hasFullChatOnPage && <FloatingAiAssistant />}
    </main>
  )
}
