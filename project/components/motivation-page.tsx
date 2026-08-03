"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export interface MotivationItem {
  id: string
  label: string | null
  content: string
  active: boolean
  source: string
  createdAt: string
}

function MotivationForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: { label: string; content: string }
  submitLabel: string
  onSubmit: (values: { label: string; content: string }) => Promise<void>
}) {
  const [label, setLabel] = useState(initial?.label ?? "")
  const [content, setContent] = useState(initial?.content ?? "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      await onSubmit({ label, content })
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    if (!content.trim() || generating) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch("/api/motivations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coreSentence: content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Gagal merangkai kalimat")
      setContent(data.content)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Gagal merangkai kalimat")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="motivation-label">Judul (opsional)</FieldLabel>
          <Input id="motivation-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: Usaha & Omset Naik" />
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="motivation-content">Isi motivasi / prinsip</FieldLabel>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
              onClick={handleGenerate}
              disabled={!content.trim() || generating}
            >
              <Wand2 className="size-3.5" />
              {generating ? "Merangkai…" : "Rangkai dengan AI"}
            </Button>
          </div>
          <Textarea
            id="motivation-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis kalimat intinya dulu (mis. 'jangan gampang menyerah'), lalu klik Rangkai dengan AI…"
            required
          />
          {generateError && <p className="text-xs text-destructive">{generateError}</p>}
          <FieldDescription>
            Dikirim apa adanya lewat WhatsApp. Tulis kalimat inti, klik &quot;Rangkai dengan AI&quot; buat dikembangkan jadi pesan
            yang lebih lengkap — atau tulis sendiri langsung kalau sudah pas.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter className="-mx-0 -mb-0 rounded-none border-t-0 bg-transparent p-0">
        <Button type="submit" className="rounded-xl" disabled={saving || !content.trim()}>
          {saving ? "Menyimpan…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function MotivationPage({ initial }: { initial: MotivationItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch("/api/motivations")
    if (!res.ok) return
    const data = await res.json()
    setItems(data.motivations)
  }

  async function handleCreate(values: { label: string; content: string }) {
    const res = await fetch("/api/motivations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (res.ok) {
      setAddOpen(false)
      await refresh()
      router.refresh()
    }
  }

  async function handleUpdate(id: string, values: { label: string; content: string }) {
    const res = await fetch(`/api/motivations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (res.ok) {
      setEditingId(null)
      await refresh()
      router.refresh()
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, active } : item)))
    const res = await fetch(`/api/motivations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) await refresh()
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus motivasi ini?")) return
    const res = await fetch(`/api/motivations/${id}`, { method: "DELETE" })
    if (res.ok) {
      setItems((current) => current.filter((item) => item.id !== id))
      router.refresh()
    }
  }

  const editingItem = items.find((item) => item.id === editingId) ?? null

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="Motivasi & Prinsip"
          description="Dikirim acak lewat WhatsApp tiap 3 jam (06:00-21:00 WIB). Bisa juga tambah langsung lewat WA: kirim pesan diawali ## Judul, isi motivasi."
          icon={Sparkles}
          action={
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={
                <Button className="gap-2 self-start rounded-xl">
                  <Plus className="size-4" />
                  Tambah Motivasi
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Motivasi</DialogTitle>
                </DialogHeader>
                <MotivationForm submitLabel="Simpan" onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          }
        />

        {items.length === 0 ? (
          <Card className="glass-card border-0 ring-0">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Belum ada motivasi tersimpan. Tambah lewat tombol di atas, atau kirim WA diawali &quot;##&quot;.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
            {items.map((item) => (
              <Card key={item.id} className="glass-card border-0 ring-0">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{item.label || "Tanpa judul"}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.source === "whatsapp" ? "dari WA" : "manual"}</Badge>
                        {!item.active && <Badge variant="secondary">nonaktif</Badge>}
                      </div>
                    </div>
                    <Switch checked={item.active} onCheckedChange={(v) => toggleActive(item.id, v)} aria-label="Aktif" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{item.content}</p>
                  <div className="flex justify-end gap-2">
                    <Dialog open={editingId === item.id} onOpenChange={(open) => setEditingId(open ? item.id : null)}>
                      <DialogTrigger render={
                        <Button variant="secondary" size="sm" className="gap-2">
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      } />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Motivasi</DialogTitle>
                        </DialogHeader>
                        {editingItem && editingItem.id === item.id && (
                          <MotivationForm
                            initial={{ label: editingItem.label ?? "", content: editingItem.content }}
                            submitLabel="Simpan Perubahan"
                            onSubmit={(values) => handleUpdate(item.id, values)}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
