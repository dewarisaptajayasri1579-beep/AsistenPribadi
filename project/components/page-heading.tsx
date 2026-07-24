import type { LucideIcon } from "lucide-react"

interface PageHeadingProps {
  title: string
  description: string
  icon: LucideIcon
  action?: React.ReactNode
}

export function PageHeading({ title, description, icon: Icon, action }: PageHeadingProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary shadow-[0_0_20px_var(--neon-glow)]">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        </div>
      </div>
      {action}
    </header>
  )
}
