import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

interface DashboardHeaderProps {
  userName: string
  onAddWithAi: () => void
}

export function DashboardHeader({ userName, onAddWithAi }: DashboardHeaderProps) {
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date())

  return (
    <header className="flex flex-col items-stretch gap-4 pb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <h1 className="text-balance text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-[32px]">
          Selamat pagi, {userName}! <span aria-hidden="true">👋</span>
        </h1>
        <p className="text-[17px] text-muted-foreground">{today}</p>
      </div>
      <Button
        size="lg"
        className="h-12 w-full rounded-xl border border-primary/50 bg-primary px-5 text-[15px] shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto"
        onClick={onAddWithAi}
      >
        <Plus data-icon="inline-start" />
        Tambah dengan AI
      </Button>
    </header>
  )
}
