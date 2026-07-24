import Link from "next/link"

import type { AgendaItem } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AgendaTimelineProps {
  items: AgendaItem[]
}

export function AgendaTimeline({ items }: AgendaTimelineProps) {
  return (
    <Card className="glass-card rounded-[18px] py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-4">
        <CardTitle className="text-xl">Agenda Hari Ini</CardTitle>
        <Button variant="secondary" size="sm" nativeButton={false} render={<Link href="#jadwal" />}>
          Lihat Kalender
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col px-4 pb-4 sm:px-6 sm:pb-6">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada agenda hari ini.</p>
        )}
        {items.map((item, index) => (
          <div key={`${item.time}-${item.title}`} className="flex min-h-14 gap-4">
            <time className="w-12 shrink-0 pt-1 text-[15px] font-medium text-foreground/90">
              {item.time}
            </time>
            <div className="relative flex w-4 shrink-0 justify-center">
              {index < items.length - 1 && (
                <span className="absolute top-4 bottom-0 w-px bg-primary/35" aria-hidden="true" />
              )}
              <span className="relative mt-1.5 size-3 rounded-full border-2 border-primary/30 bg-primary" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 pb-3">
              <p className="text-pretty text-[15px] leading-snug font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.location}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
