"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Bot, Save, Settings, TrendingUp, UserRound } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { PushNotificationCard } from "@/components/push-notification-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

interface SettingsValues {
  name: string
  role: string
  email: string
  phoneNumber: string
  assistantInstructions: string
  notifyAgenda: boolean
  notifyDailyReport: boolean
  notifyPriorityAlert: boolean
  notifyMorningBriefing: boolean
  notifyStockMarket: boolean
  stockNotifyPhone1: string
  stockNotifyPhone2: string
}

export function SettingsPage({ initial }: { initial: SettingsValues }) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  function update<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("saving")
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error("failed")
      setStatus("saved")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  return (
    <AppShell>
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <PageHeading
          title="Pengaturan"
          description="Atur profil, notifikasi, dan preferensi AI Assistant."
          icon={Settings}
          action={
            <Button type="submit" className="self-start rounded-xl" disabled={status === "saving"}>
              <Save data-icon="inline-start" />
              {status === "saving" ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          }
        />

        {status === "saved" && (
          <div role="status" className="rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm text-success">
            Pengaturan berhasil disimpan.
          </div>
        )}
        {status === "error" && (
          <div role="status" className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Gagal menyimpan pengaturan. Coba lagi.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" aria-hidden="true" />
                Profil
              </CardTitle>
              <CardDescription>Informasi dasar yang tampil di dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Nama</FieldLabel>
                  <Input id="name" value={values.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role">Jabatan</FieldLabel>
                  <Input id="role" value={values.role} onChange={(e) => update("role", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Nomor WhatsApp</FieldLabel>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={values.phoneNumber}
                    onChange={(e) => update("phoneNumber", e.target.value)}
                    autoComplete="tel"
                  />
                  <FieldDescription>Wajib diisi supaya bisa menerima reminder & briefing lewat WhatsApp.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5 text-primary" aria-hidden="true" />
                Notifikasi WhatsApp
              </CardTitle>
              <CardDescription>
                Pilih pengingat yang ingin diterima lewat WhatsApp (nomor di atas wajib diisi).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal" className="rounded-xl border border-border bg-secondary/25 p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="agenda-notification">Pengingat agenda</FieldLabel>
                    <FieldDescription>Kirim WhatsApp 15 menit sebelum agenda dimulai.</FieldDescription>
                  </FieldContent>
                  <Switch id="agenda-notification" checked={values.notifyAgenda} onCheckedChange={(v) => update("notifyAgenda", v)} />
                </Field>
                <Field orientation="horizontal" className="rounded-xl border border-border bg-secondary/25 p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="daily-report">Evaluasi malam</FieldLabel>
                    <FieldDescription>Kirim ringkasan tugas selesai/belum jam 20:00 WIB.</FieldDescription>
                  </FieldContent>
                  <Switch id="daily-report" checked={values.notifyDailyReport} onCheckedChange={(v) => update("notifyDailyReport", v)} />
                </Field>
                <Field orientation="horizontal" className="rounded-xl border border-border bg-secondary/25 p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="priority-alert">Tugas prioritas tinggi</FieldLabel>
                    <FieldDescription>Berikan notifikasi untuk tugas mendesak.</FieldDescription>
                  </FieldContent>
                  <Switch id="priority-alert" checked={values.notifyPriorityAlert} onCheckedChange={(v) => update("notifyPriorityAlert", v)} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" aria-hidden="true" />
                Notif Bursa Saham
              </CardTitle>
              <CardDescription>Kirim alert harga saham lewat WhatsApp ke maksimal 2 nomor.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal" className="rounded-xl border border-border bg-secondary/25 p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="stock-notification">Aktifkan notifikasi</FieldLabel>
                    <FieldDescription>Kirim WhatsApp saat harga saham capai target.</FieldDescription>
                  </FieldContent>
                  <Switch id="stock-notification" checked={values.notifyStockMarket} onCheckedChange={(v) => update("notifyStockMarket", v)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-phone-1">Nomor WhatsApp 1</FieldLabel>
                  <Input
                    id="stock-phone-1"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={values.stockNotifyPhone1}
                    onChange={(e) => update("stockNotifyPhone1", e.target.value)}
                    autoComplete="tel"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-phone-2">Nomor WhatsApp 2</FieldLabel>
                  <Input
                    id="stock-phone-2"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={values.stockNotifyPhone2}
                    onChange={(e) => update("stockNotifyPhone2", e.target.value)}
                    autoComplete="tel"
                  />
                  <FieldDescription>Opsional. Kosongkan jika hanya butuh 1 nomor.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <PushNotificationCard />

          <Card className="glass-card border-0 ring-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5 text-primary" aria-hidden="true" />
                Preferensi AI Assistant
              </CardTitle>
              <CardDescription>Sesuaikan cara AI membantu aktivitas harian Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="assistant-note">Instruksi khusus</FieldLabel>
                  <Textarea
                    id="assistant-note"
                    rows={4}
                    value={values.assistantInstructions}
                    onChange={(e) => update("assistantInstructions", e.target.value)}
                    placeholder="Contoh: Gunakan bahasa Indonesia yang singkat. Prioritaskan agenda bisnis dan selalu konfirmasi sebelum mengubah jadwal penting."
                  />
                  <FieldDescription>
                    Instruksi ini benar-benar dikirim ke Claude sebagai bagian dari system prompt di setiap percakapan.
                  </FieldDescription>
                </Field>
                <Field orientation="horizontal" className="rounded-xl border border-border bg-secondary/25 p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="morning-briefing">Briefing pagi otomatis</FieldLabel>
                    <FieldDescription>Kirim ringkasan agenda & prioritas lewat WhatsApp jam 07:00 WIB.</FieldDescription>
                  </FieldContent>
                  <Switch id="morning-briefing" checked={values.notifyMorningBriefing} onCheckedChange={(v) => update("notifyMorningBriefing", v)} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </form>
    </AppShell>
  )
}
