"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bot,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Home,
  LogOut,
  Settings,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface DirectorSidebarProps {
  collapsed: boolean
  onToggle: () => void
  userName: string
  userRole: string
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const menuItems = [
  { label: "Dashboard", icon: Home, href: "/" },
  { label: "AI Assistant", icon: Bot, href: "/assistant" },
  { label: "Jadwal & Tugas", icon: CalendarDays, href: "/jadwal" },
  { label: "Laporan Harian", icon: ChartNoAxesColumnIncreasing, href: "/laporan" },
  { label: "Biaya AI", icon: CircleDollarSign, href: "/biaya-ai" },
  { label: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-10 shrink-0 grid-cols-2 gap-1 rounded-xl border border-primary/30 bg-primary/15 p-2 shadow-[0_0_22px_var(--neon-glow)]" aria-hidden="true">
        <span className="rounded-sm bg-primary" />
        <span className="rounded-sm bg-chart-2" />
        <span className="col-span-2 rounded-sm bg-primary/80" />
      </div>
      {!compact && (
        <div className="flex min-w-0 flex-col">
          <span className="text-[17px] font-semibold">Director</span>
          <span className="text-sm text-muted-foreground">Daily Assistant</span>
        </div>
      )}
    </div>
  )
}

export function DirectorSidebar({ collapsed, onToggle, userName, userRole }: DirectorSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = initialsOf(userName)

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-3 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-1">
          <Brand />
          <Avatar className="size-10 shrink-0 border border-primary/30 shadow-[0_0_18px_var(--neon-glow)]">
            <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <nav aria-label="Navigasi utama mobile" className="flex gap-2 overflow-x-auto pb-1">
          {menuItems.map(({ label, icon: Icon, href }) => {
            const active = isActive(href)
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary/50 bg-primary/20 text-foreground shadow-[0_0_18px_var(--neon-glow)]"
                    : "border-border bg-secondary/25 text-foreground/75 hover:border-primary/30 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <aside
        className={cn(
          "glass-card sticky top-6 hidden h-[calc(100dvh-48px)] shrink-0 flex-col rounded-[18px] transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-20" : "w-60"
        )}
      >
        <div className={cn("flex h-24 items-center", collapsed ? "justify-center px-3" : "justify-between px-5")}>
          <Brand compact={collapsed} />
          {!collapsed && (
            <Button variant="secondary" size="icon" onClick={onToggle} aria-label="Tutup sidebar">
              <ChevronsLeft />
            </Button>
          )}
        </div>

        {collapsed && (
          <Button variant="ghost" size="icon-sm" className="mx-auto mb-4" onClick={onToggle} aria-label="Buka sidebar">
            <ChevronsRight />
          </Button>
        )}

        <nav aria-label="Navigasi utama" className={cn("flex flex-col gap-2", collapsed ? "px-3" : "px-4")}>
          {menuItems.map(({ label, icon: Icon, href }) => {
            const active = isActive(href)
            const navButton = (
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 w-full items-center rounded-xl border text-left text-[17px] font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "gap-4 px-4",
                  active
                    ? "border-primary/45 bg-primary/20 text-foreground shadow-[0_0_18px_var(--neon-glow)]"
                    : "border-transparent text-foreground/80 hover:bg-secondary/45 hover:text-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            )

            return collapsed ? (
              <Tooltip key={label}>
                <TooltipTrigger render={navButton} />
                <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
              </Tooltip>
            ) : <div key={label}>{navButton}</div>
          })}
        </nav>

        <div className={cn("mt-auto p-4", collapsed && "px-3")}>
          <div className={cn("flex items-center rounded-2xl border border-border bg-secondary/35", collapsed ? "justify-center p-2" : "gap-3 p-3")}>
            <Avatar className="size-11 shrink-0 border border-primary/30">
              <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{userName}</p>
                  <p className="truncate text-sm text-muted-foreground">{userRole}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
