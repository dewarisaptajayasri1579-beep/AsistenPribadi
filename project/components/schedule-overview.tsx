import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { AgendaItem } from "@/lib/dashboard-data"
import { weekDays } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ScheduleOverviewProps {
  agenda: AgendaItem[]
}

export function ScheduleOverview({ agenda }: ScheduleOverviewProps) {
  return (
    <Card id="jadwal" className="glass-card rounded-[18px] py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-3">
        <CardTitle className="text-xl">Jadwal &amp; Tugas</CardTitle>
        <Button variant="secondary" size="sm" nativeButton={false} render={<Link href="#jadwal" />}>
          Lihat Kalender
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-primary/15 bg-secondary/30 p-2 sm:gap-3">
          <Button variant="ghost" size="icon-sm" aria-label="Bulan sebelumnya">
            <ChevronLeft />
          </Button>
          <p className="min-w-20 text-sm font-medium">Juli 2026</p>
          <div className="grid min-w-96 flex-1 grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day.date}
                className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-xs ${
                  day.date === 23 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <span>{day.label}</span>
                <span className="font-semibold">{day.date}</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Bulan berikutnya">
            <ChevronRight />
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {agenda.map((item) => (
            <div key={item.time} className="grid min-h-10 grid-cols-[10px_48px_minmax(0,1fr)_16px] items-center gap-2 text-sm sm:grid-cols-[10px_48px_minmax(0,1fr)_auto_16px] sm:gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <time className="w-12 shrink-0 font-medium">{item.time}</time>
              <p className="min-w-0 text-pretty leading-snug text-foreground/90">{item.title}</p>
              <p className="col-start-3 text-xs text-muted-foreground sm:col-start-auto sm:text-sm">{item.location}</p>
              <span className="size-4 shrink-0 rounded-full border border-muted-foreground" aria-hidden="true" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
