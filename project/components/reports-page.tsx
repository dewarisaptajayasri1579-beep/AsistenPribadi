"use client"

import { AlertTriangle, BarChart3, CalendarCheck2, CheckCircle2, Download, Flag } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DailyReportData } from "@/lib/report-queries"

interface ReportsPageProps {
  data: DailyReportData
  todayLabel: string
}

const statusStyle: Record<string, string> = {
  Selesai: "bg-success/15 text-success",
  Berjalan: "bg-primary/15 text-primary",
  "Akan Datang": "bg-muted text-muted-foreground",
}

export function ReportsPage({ data, todayLabel }: ReportsPageProps) {
  const { stats, activities, overdueFollowUps, tomorrowFocus } = data

  const reportStats = [
    { label: "Agenda Hari Ini", value: String(stats.agendaCount), icon: CalendarCheck2 },
    { label: "Tugas Selesai", value: String(stats.doneToday), icon: CheckCircle2 },
    { label: "Tugas Belum Selesai", value: String(stats.undoneCount), icon: BarChart3 },
    { label: "Prioritas Tinggi", value: String(stats.highPriorityCount), icon: Flag },
  ]

  function handleDownload() {
    const lines = [
      `Laporan Harian - ${todayLabel}`,
      "",
      "Ringkasan:",
      `- Agenda hari ini: ${stats.agendaCount}`,
      `- Tugas selesai: ${stats.doneToday}`,
      `- Tugas belum selesai: ${stats.undoneCount}`,
      `- Prioritas tinggi: ${stats.highPriorityCount}`,
      "",
      "Aktivitas Hari Ini:",
      ...(activities.length
        ? activities.map((a) => `- ${a.time} ${a.title} (${a.status})`)
        : ["- Tidak ada agenda"]),
      "",
      "Follow-up Terlambat:",
      ...(overdueFollowUps.length ? overdueFollowUps.map((f) => `- ${f}`) : ["- Tidak ada"]),
      "",
      "Fokus Besok:",
      ...(tomorrowFocus.schedules.length
        ? tomorrowFocus.schedules.map((s) => `- ${s.time} ${s.title}`)
        : ["- Tidak ada agenda"]),
      ...tomorrowFocus.highPriorityTasks.map((t) => `- [Prioritas Tinggi] ${t}`),
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laporan-harian-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="Laporan Harian"
          description="Ringkasan pencapaian dan aktivitas Anda hari ini."
          icon={BarChart3}
          action={
            <Button variant="outline" className="self-start rounded-xl" onClick={handleDownload}>
              <Download data-icon="inline-start" />
              Unduh Laporan
            </Button>
          }
        />

        <section aria-label="Ringkasan laporan" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {reportStats.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="glass-card border-0 ring-0">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] xl:gap-5">
          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle>Aktivitas Hari Ini</CardTitle>
              <CardDescription>{todayLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada agenda hari ini.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/25 p-3">
                      <span className="w-12 shrink-0 text-sm font-medium text-primary">{activity.time}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{activity.title}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[activity.status]}`}>
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle>Follow-up Terlambat</CardTitle>
              <CardDescription>Perlu segera ditindaklanjuti.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {overdueFollowUps.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  Tidak ada follow-up yang terlambat.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overdueFollowUps.map((title) => (
                    <li key={title} className="flex items-start gap-2 text-sm text-foreground/85">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                      {title}
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <h2 className="text-sm font-semibold">Fokus Besok</h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                  {tomorrowFocus.schedules.length === 0 && tomorrowFocus.highPriorityTasks.length === 0 && (
                    <li>Tidak ada agenda atau tugas prioritas untuk besok.</li>
                  )}
                  {tomorrowFocus.schedules.map((s) => (
                    <li key={s.title}>• {s.time} {s.title}</li>
                  ))}
                  {tomorrowFocus.highPriorityTasks.map((t) => (
                    <li key={t}>• {t}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
