"use client"

import { useEffect, useState } from "react"
import { Check, ShieldCheck, Trash2, UserRoundX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Director {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  role: string
  approvedAt: string | null
}

export function ManageDirectorsCard({ currentUserId }: { currentUserId: string }) {
  const [pending, setPending] = useState<Director[]>([])
  const [approved, setApproved] = useState<Director[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load() {
    const res = await fetch("/api/admin/directors")
    if (!res.ok) return
    const data = await res.json()
    setPending(data.pending)
    setApproved(data.approved)
  }

  useEffect(() => {
    load()
  }, [])

  async function act(id: string, run: () => Promise<Response>) {
    setBusyId(id)
    setError("")
    try {
      const res = await run()
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Gagal memproses")
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const setApproval = (id: string, approved: boolean) =>
    act(id, () =>
      fetch("/api/admin/directors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      })
    )

  const reject = (id: string) =>
    act(id, () => fetch(`/api/admin/directors?id=${id}`, { method: "DELETE" }))

  return (
    <Card className="glass-card border-0 ring-0 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          Kelola Direktur
        </CardTitle>
        <CardDescription>
          Setujui pendaftar baru supaya bisa mulai memakai Naya. Kamu cuma mengelola akunnya — isi
          tugas, jadwal, dan keuangan tiap direktur tetap tidak bisa kamu lihat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Menunggu persetujuan ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nggak ada pendaftar baru.</p>
          ) : (
            pending.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.email}
                    {d.phoneNumber ? ` · ${d.phoneNumber}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" className="rounded-lg" disabled={busyId === d.id} onClick={() => setApproval(d.id, true)}>
                    <Check data-icon="inline-start" />
                    Setujui
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={busyId === d.id} onClick={() => reject(d.id)}>
                    <Trash2 data-icon="inline-start" />
                    Tolak
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Direktur aktif ({approved.length})</h3>
          {approved.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {d.name}
                  {d.id === currentUserId && <span className="ml-2 text-xs text-muted-foreground">(kamu)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.email}
                  {d.phoneNumber ? ` · ${d.phoneNumber}` : " · nomor WA belum diisi"}
                </p>
              </div>
              {d.id !== currentUserId && (
                <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-lg" disabled={busyId === d.id} onClick={() => setApproval(d.id, false)}>
                  <UserRoundX data-icon="inline-start" />
                  Nonaktifkan
                </Button>
              )}
            </div>
          ))}
        </section>
      </CardContent>
    </Card>
  )
}
