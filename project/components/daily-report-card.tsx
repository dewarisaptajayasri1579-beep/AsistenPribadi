import { CircleCheck, Clock3, Flag, Sparkles } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DailyReportCardProps {
  report: {
    doneToday: number
    undoneToday: number
    highPriority: number
    overdueFollowUps: string[]
  }
}

export function DailyReportCard({ report }: DailyReportCardProps) {
  const metrics = [
    { label: "Selesai", value: report.doneToday, icon: CircleCheck, color: "text-success" },
    { label: "Belum Selesai", value: report.undoneToday, icon: Clock3, color: "text-warning" },
    { label: "Prioritas Tinggi", value: report.highPriority, icon: Flag, color: "text-destructive" },
  ]

  const totalToday = report.doneToday + report.undoneToday
  const productivity = totalToday > 0 ? Math.round((report.doneToday / totalToday) * 100) : 0

  return (
    <Card className="glass-card rounded-[18px] py-0">
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-xl">Laporan Harian</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-secondary/25 p-3">
              <Icon className={`size-5 shrink-0 ${color}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/25 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <h3 className="text-[15px] font-semibold">Catatan AI</h3>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">
            Produktivitas hari ini {productivity}%.
            <br />
            {report.overdueFollowUps.length > 0
              ? `Follow-up terlambat: ${report.overdueFollowUps.join(", ")}.`
              : "Tidak ada follow-up yang terlambat."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
