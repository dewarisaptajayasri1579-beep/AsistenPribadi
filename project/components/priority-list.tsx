import type { PriorityItem } from "@/lib/dashboard-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PriorityListProps {
  items: PriorityItem[]
}

export function PriorityList({ items }: PriorityListProps) {
  return (
    <Card className="glass-card rounded-[18px] py-0">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-xl">Prioritas Utama</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-6 pb-6">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada tugas prioritas tinggi.</p>
        )}
        {items.map((item, index) => (
          <article
            key={item.title}
            className="grid min-h-20 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-secondary/30 px-3 py-3 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:px-4"
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold",
                index === 0 && "border-primary text-primary",
                index === 1 && "border-chart-2 text-chart-2",
                index === 2 && "border-warning text-warning"
              )}
            >
              {index + 1}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="text-pretty text-[15px] leading-snug font-medium">{item.title}</h3>
              <p className="text-pretty text-sm leading-snug text-muted-foreground">{item.description}</p>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "col-start-2 w-fit shrink-0 rounded-lg px-3 py-1 sm:col-start-auto",
                item.level === "Tinggi" ? "text-destructive" : "text-warning"
              )}
            >
              {item.level}
            </Badge>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}
