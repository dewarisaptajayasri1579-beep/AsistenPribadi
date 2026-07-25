"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock3, MapPin, Plus, UserRound } from "lucide-react"

import { AiCommandDialog } from "@/components/ai-command-dialog"
import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AgendaItem = { id: string; time: string; title: string; location: string }
type TaskItem = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  startDate: string | null
  dueDate: string | null
}
type FollowUpItem = {
  id: string
  title: string
  relatedPerson: string | null
  notes: string | null
  status: string
  dueDate: string | null
}
type WeekDay = { label: string; date: number; month: number; year: number; iso: string; isToday: boolean }

interface SchedulePageProps {
  agenda: AgendaItem[]
  tasks: TaskItem[]
  followUps: FollowUpItem[]
  weekDays: WeekDay[]
  selectedDateIso: string
  selectedDateLabel: string
  prevDateIso: string
  nextDateIso: string
  prevWeekDateIso: string
  nextWeekDateIso: string
  todayDateIso: string
  isToday: boolean
}

const priorityLabel: Record<string, string> = { high: "Tinggi", normal: "Sedang", low: "Rendah" }

export function SchedulePage({
  agenda,
  tasks,
  followUps,
  weekDays,
  selectedDateIso,
  selectedDateLabel,
  prevDateIso,
  nextDateIso,
  prevWeekDateIso,
  nextWeekDateIso,
  todayDateIso,
  isToday,
}: SchedulePageProps) {
  const router = useRouter()
  const [taskList, setTaskList] = useState(tasks)
  const [followUpList, setFollowUpList] = useState(followUps)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<string[]>([])

  function goToDate(dateIso: string) {
    router.push(`/jadwal?date=${dateIso}`)
  }

  const doneCount = taskList.filter((t) => t.status === "done").length
  const doneFollowUpCount = followUpList.filter((f) => f.status === "done").length

  async function toggleTask(task: TaskItem) {
    if (pendingIds.includes(task.id)) return
    const nextStatus = task.status === "done" ? "todo" : "done"

    setPendingIds((current) => [...current, task.id])
    setTaskList((current) => current.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error("failed")
    } catch {
      setTaskList((current) => current.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
    } finally {
      setPendingIds((current) => current.filter((id) => id !== task.id))
    }
  }

  async function toggleFollowUp(followUp: FollowUpItem) {
    if (pendingIds.includes(followUp.id)) return
    const nextStatus = followUp.status === "done" ? "open" : "done"

    setPendingIds((current) => [...current, followUp.id])
    setFollowUpList((current) => current.map((f) => (f.id === followUp.id ? { ...f, status: nextStatus } : f)))

    try {
      const res = await fetch(`/api/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error("failed")
    } catch {
      setFollowUpList((current) => current.map((f) => (f.id === followUp.id ? { ...f, status: followUp.status } : f)))
    } finally {
      setPendingIds((current) => current.filter((id) => id !== followUp.id))
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="Jadwal & Tugas"
          description="Lihat agenda hari ini dan pantau tugas yang perlu diselesaikan."
          icon={CalendarDays}
          action={
            <Button className="self-start rounded-xl" onClick={() => setDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Tambah Agenda
            </Button>
          }
        />

        <Card className="glass-card border-0 ring-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Minggu Ini</CardTitle>
              <CardDescription>Klik tanggal untuk melihat agenda hari itu.</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Minggu sebelumnya" onClick={() => goToDate(prevWeekDateIso)}>
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Minggu berikutnya" onClick={() => goToDate(nextWeekDateIso)}>
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isSelected = day.iso === selectedDateIso
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => goToDate(day.iso)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-primary/50 bg-primary/20 text-foreground shadow-[0_0_18px_var(--neon-glow)]"
                      : day.isToday
                        ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-primary/30 bg-secondary/25 text-foreground/85"
                        : "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary/25 text-foreground/75 transition-colors hover:border-primary/30"
                  }
                >
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                  <span className="font-semibold">{day.date}</span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] xl:gap-5">
          <Card className="glass-card border-0 ring-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Agenda</CardTitle>
                <CardDescription>{selectedDateLabel}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Hari sebelumnya" onClick={() => goToDate(prevDateIso)}>
                  <ChevronLeft />
                </Button>
                {!isToday && (
                  <Button variant="secondary" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => goToDate(todayDateIso)}>
                    Hari Ini
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Hari berikutnya" onClick={() => goToDate(nextDateIso)}>
                  <ChevronRight />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {agenda.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada agenda di tanggal ini.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {agenda.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded-xl border border-border bg-secondary/25 p-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Clock3 className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-medium">{item.title}</h2>
                          <span className="text-sm font-medium text-primary">{item.time}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {item.location}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle>Daftar Tugas</CardTitle>
              <CardDescription>
                {doneCount} dari {taskList.length} selesai
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taskList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada tugas.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {taskList.map((task) => {
                    const completed = task.status === "done"
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => toggleTask(task)}
                          aria-pressed={completed}
                          className="flex w-full items-start gap-3 rounded-xl border border-border bg-secondary/25 p-3 text-left transition-colors hover:border-primary/30 disabled:opacity-60"
                          disabled={pendingIds.includes(task.id)}
                        >
                          {completed ? (
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                          ) : (
                            <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className={completed ? "block font-medium text-muted-foreground line-through" : "block font-medium"}>
                                {task.title}
                              </span>
                              <span className="shrink-0 text-xs font-medium text-muted-foreground">{priorityLabel[task.priority] ?? task.priority}</span>
                            </span>
                            {task.description && (
                              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{task.description}</span>
                            )}
                            {(task.startDate || task.dueDate) && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {task.startDate ? `Mulai ${task.startDate}` : ""}
                                {task.startDate && task.dueDate ? " · " : ""}
                                {task.dueDate ? `Selesai ${task.dueDate}` : ""}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-0 ring-0 lg:col-span-2">
            <CardHeader>
              <CardTitle>Follow-up</CardTitle>
              <CardDescription>
                {doneFollowUpCount} dari {followUpList.length} selesai
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followUpList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada follow-up.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {followUpList.map((followUp) => {
                    const completed = followUp.status === "done"
                    return (
                      <li key={followUp.id}>
                        <button
                          type="button"
                          onClick={() => toggleFollowUp(followUp)}
                          aria-pressed={completed}
                          className="flex w-full items-start gap-3 rounded-xl border border-border bg-secondary/25 p-3 text-left transition-colors hover:border-primary/30 disabled:opacity-60"
                          disabled={pendingIds.includes(followUp.id)}
                        >
                          {completed ? (
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                          ) : (
                            <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={completed ? "block font-medium text-muted-foreground line-through" : "block font-medium"}>
                              {followUp.title}
                            </span>
                            {followUp.relatedPerson && (
                              <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <UserRound className="size-3.5" aria-hidden="true" />
                                {followUp.relatedPerson}
                              </span>
                            )}
                            {followUp.notes && (
                              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{followUp.notes}</span>
                            )}
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {followUp.dueDate ? `Target: ${followUp.dueDate}` : "Menunggu konfirmasi tanggal"}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AiCommandDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) router.refresh()
        }}
      />
    </AppShell>
  )
}
