"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus, Trash2, Wallet } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface TransactionItem {
  id: string
  type: string
  amount: number
  category: string | null
  description: string | null
  occurredAt: string
  source: string
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
}

function toDateInputValue(iso: string) {
  return iso.slice(0, 10)
}

function TransactionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: { type: string; amount: string; category: string; description: string; occurredAt: string }
  submitLabel: string
  onSubmit: (values: { type: string; amount: number; category: string; description: string; occurredAt: string }) => Promise<void>
}) {
  const [type, setType] = useState(initial?.type ?? "expense")
  const [amount, setAmount] = useState(initial?.amount ?? "")
  const [category, setCategory] = useState(initial?.category ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ?? toDateInputValue(new Date().toISOString()))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountNumber = Number(amount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return
    setSaving(true)
    try {
      await onSubmit({ type, amount: amountNumber, category, description, occurredAt })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel>Jenis</FieldLabel>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "secondary"}
              className="flex-1 gap-2 rounded-xl"
              onClick={() => setType("expense")}
            >
              <ArrowDownCircle className="size-4" />
              Pengeluaran
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "secondary"}
              className="flex-1 gap-2 rounded-xl"
              onClick={() => setType("income")}
            >
              <ArrowUpCircle className="size-4" />
              Pemasukan
            </Button>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="transaction-amount">Nominal (Rp)</FieldLabel>
          <Input
            id="transaction-amount"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: 50000"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transaction-category">Kategori (opsional)</FieldLabel>
          <Input
            id="transaction-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Contoh: makan, transportasi, belanja"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transaction-description">Keterangan (opsional)</FieldLabel>
          <Input
            id="transaction-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Indomaret, parkir kantor"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transaction-date">Tanggal</FieldLabel>
          <Input
            id="transaction-date"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </Field>
      </FieldGroup>
      <DialogFooter className="-mx-0 -mb-0 rounded-none border-t-0 bg-transparent p-0">
        <Button type="submit" className="rounded-xl" disabled={saving || !amount}>
          {saving ? "Menyimpan…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function FinancePage({ initial }: { initial: TransactionItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalIncome = items.reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum), 0)
  const totalExpense = items.reduce((sum, t) => (t.type === "expense" ? sum + t.amount : sum), 0)

  async function refresh() {
    const res = await fetch("/api/transactions")
    if (!res.ok) return
    const data = await res.json()
    setItems(data.transactions)
  }

  async function handleCreate(values: { type: string; amount: number; category: string; description: string; occurredAt: string }) {
    const res = await fetch("/api/transactions", {
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

  async function handleUpdate(id: string, values: { type: string; amount: number; category: string; description: string; occurredAt: string }) {
    const res = await fetch(`/api/transactions/${id}`, {
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

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus transaksi ini?")) return
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" })
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
          title="Keuangan"
          description="Catat pemasukan & pengeluaran manual di sini, atau lewat WhatsApp — kirim teks (mis. 'keluar 20rb parkir') atau foto nota, AI otomatis membacanya."
          icon={Wallet}
          action={
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={
                <Button className="gap-2 self-start rounded-xl">
                  <Plus className="size-4" />
                  Tambah Transaksi
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Transaksi</DialogTitle>
                </DialogHeader>
                <TransactionForm submitLabel="Simpan" onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          }
        />

        <section aria-label="Ringkasan keuangan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="glass-card border-0 ring-0">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <ArrowUpCircle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                <p className="truncate text-xl font-semibold">{formatRupiah(totalIncome)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-0 ring-0">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <ArrowDownCircle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                <p className="truncate text-xl font-semibold">{formatRupiah(totalExpense)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-0 ring-0">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Wallet className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className="truncate text-xl font-semibold">{formatRupiah(totalIncome - totalExpense)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {items.length === 0 ? (
          <Card className="glass-card border-0 ring-0">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Belum ada transaksi tercatat. Tambah lewat tombol di atas, atau kirim WA (teks/foto nota).
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <Card key={item.id} className="glass-card border-0 ring-0">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        item.type === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {item.type === "income" ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.description || item.category || (item.type === "income" ? "Pemasukan" : "Pengeluaran")}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>
                          {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(
                            new Date(item.occurredAt)
                          )}
                        </span>
                        {item.category && <Badge variant="outline">{item.category}</Badge>}
                        {item.source !== "manual" && <Badge variant="outline">dari WA</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={cn("text-base font-semibold whitespace-nowrap", item.type === "income" ? "text-emerald-500" : "text-destructive")}>
                      {item.type === "income" ? "+" : "-"}
                      {formatRupiah(item.amount)}
                    </p>
                    <Dialog open={editingId === item.id} onOpenChange={(open) => setEditingId(open ? item.id : null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon-sm" aria-label="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                      } />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Transaksi</DialogTitle>
                        </DialogHeader>
                        {editingItem && editingItem.id === item.id && (
                          <TransactionForm
                            initial={{
                              type: editingItem.type,
                              amount: String(editingItem.amount),
                              category: editingItem.category ?? "",
                              description: editingItem.description ?? "",
                              occurredAt: toDateInputValue(editingItem.occurredAt),
                            }}
                            submitLabel="Simpan Perubahan"
                            onSubmit={(values) => handleUpdate(item.id, values)}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="size-3.5" />
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
