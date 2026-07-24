"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface AiCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiCommandDialog({ open, onOpenChange }: AiCommandDialogProps) {
  const router = useRouter()
  const [command, setCommand] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const value = command.trim()
    if (!value || pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Gagal memproses perintah")
      }
      setCommand("")
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses perintah")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-md rounded-[18px] border-border bg-popover p-6">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl">Tambah dengan AI</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Tulis agenda atau tugas baru dengan bahasa sehari-hari.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          className="h-12 rounded-xl bg-secondary/40 text-base"
          placeholder="Contoh: Jadwalkan review proyek besok jam 9"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === "Enter") handleSubmit()
          }}
          disabled={pending}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="-mx-6 -mb-6 p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Memproses…" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
