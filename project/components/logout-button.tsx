"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Button type="button" variant="outline" className="self-start rounded-xl" onClick={handleLogout}>
      <LogOut data-icon="inline-start" />
      Keluar
    </Button>
  )
}
