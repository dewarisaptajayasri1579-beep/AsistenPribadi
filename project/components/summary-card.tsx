import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface SummaryCardProps {
  title: string
  value: number
  supportingText: string
  icon: LucideIcon
  tone: "blue" | "green" | "rose"
}

const toneClasses = {
  blue: "bg-primary/16 text-primary",
  green: "bg-success/14 text-success",
  rose: "bg-destructive/14 text-destructive",
}

export function SummaryCard({
  title,
  value,
  supportingText,
  icon: Icon,
  tone,
}: SummaryCardProps) {
  return (
    <Card className="glass-card rounded-[18px] py-0">
      <CardContent className="flex items-center gap-4 p-4 sm:gap-5 sm:p-6">
        <div
          className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
        >
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-pretty text-[17px] leading-snug font-medium">{title}</p>
          <p className="text-[30px] leading-none font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{supportingText}</p>
        </div>
      </CardContent>
    </Card>
  )
}
