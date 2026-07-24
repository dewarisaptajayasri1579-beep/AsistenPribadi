import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface AiBriefingProps {
  userName: string
  agendaCount: number
  highPriorityCount: number
}

export function AiBriefing({ userName, agendaCount, highPriorityCount }: AiBriefingProps) {
  const agendaText = agendaCount === 0 ? "tidak ada agenda" : `${agendaCount} agenda`
  const priorityText = highPriorityCount === 0 ? "tidak ada prioritas tinggi" : `${highPriorityCount} prioritas utama`

  return (
    <Card className="glass-card rounded-[18px] py-0">
      <CardContent className="flex items-center gap-5 p-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-semibold">Briefing AI</h2>
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Selamat pagi {userName}, Anda memiliki {agendaText} hari ini dengan {priorityText}. Saya akan mengingatkan Anda sebelum setiap agenda dimulai.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
