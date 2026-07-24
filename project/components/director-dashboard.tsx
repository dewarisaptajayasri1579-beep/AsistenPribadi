"use client"

import { useState } from "react"
import { CalendarDays, CircleCheckBig, Flag } from "lucide-react"

import { AgendaTimeline } from "@/components/agenda-timeline"
import { AiAssistantPanel } from "@/components/ai-assistant-panel"
import { AiBriefing } from "@/components/ai-briefing"
import { AiCommandDialog } from "@/components/ai-command-dialog"
import { AppShell } from "@/components/app-shell"
import { DailyReportCard } from "@/components/daily-report-card"
import { DashboardHeader } from "@/components/dashboard-header"
import { PriorityList } from "@/components/priority-list"
import { ScheduleOverview } from "@/components/schedule-overview"
import { SummaryCard } from "@/components/summary-card"
import type { DashboardData } from "@/lib/dashboard-queries"

interface DirectorDashboardProps {
  userName: string
  data: DashboardData
}

export function DirectorDashboard({ userName, data }: DirectorDashboardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <AppShell>
      <div className="flex min-w-0 flex-1 flex-col gap-4 min-[1400px]:flex-row min-[1400px]:items-start min-[1400px]:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
          <DashboardHeader userName={userName} onAddWithAi={() => setDialogOpen(true)} />

          <section aria-label="Ringkasan hari ini" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 xl:gap-5">
            <SummaryCard title="Agenda Hari Ini" value={data.summary.agendaCount} supportingText="Kegiatan" icon={CalendarDays} tone="blue" />
            <SummaryCard title="Tugas Belum Selesai" value={data.summary.undoneTasksCount} supportingText="Tugas" icon={CircleCheckBig} tone="green" />
            <SummaryCard title="Prioritas Tinggi" value={data.summary.highPriorityCount} supportingText="Tugas" icon={Flag} tone="rose" />
          </section>

          <section aria-label="Agenda dan prioritas" className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)] xl:gap-5">
            <AgendaTimeline items={data.agenda} />
            <PriorityList items={data.priorities} />
          </section>

          <AiBriefing
            userName={userName}
            agendaCount={data.summary.agendaCount}
            highPriorityCount={data.summary.highPriorityCount}
          />

          <section aria-label="Jadwal dan laporan" className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)] xl:gap-5">
            <ScheduleOverview agenda={data.agenda} />
            <DailyReportCard report={data.report} />
          </section>
        </div>

        <AiAssistantPanel userName={userName} />
      </div>

      <AiCommandDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  )
}
