"use client"

import { useEffect, useState } from "react"
import { BellRing } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

type Status = "unsupported" | "checking" | "denied" | "subscribed" | "unsubscribed"

export function PushNotificationCard() {
  const [status, setStatus] = useState<Status>("checking")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        setStatus("denied")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setStatus(subscription ? "subscribed" : "unsubscribed")
    }
    check().catch(() => setStatus("unsupported"))
  }, [])

  async function handleEnable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed")
        return
      }

      const registration = await navigator.serviceWorker.ready
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error("VAPID public key belum di-set")

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })

      setStatus("subscribed")
    } catch (error) {
      console.error("Gagal mengaktifkan push notification:", error)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setStatus("unsubscribed")
    } catch (error) {
      console.error("Gagal menonaktifkan push notification:", error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="glass-card border-0 ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5 text-primary" aria-hidden="true" />
          Notifikasi Browser (Push)
        </CardTitle>
        <CardDescription>
          Terima pengingat langsung di HP/laptop ini lewat notifikasi browser — kanal tambahan di luar WhatsApp,
          jenis pengingatnya mengikuti pengaturan di atas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/25 p-3">
        {status === "checking" && <p className="text-sm text-muted-foreground">Mengecek status…</p>}
        {status === "unsupported" && (
          <p className="text-sm text-muted-foreground">Browser ini tidak mendukung push notification.</p>
        )}
        {status === "denied" && (
          <p className="text-sm text-muted-foreground">
            Izin notifikasi diblokir. Aktifkan lewat pengaturan situs di browser kamu.
          </p>
        )}
        {status === "unsubscribed" && (
          <>
            <p className="text-sm text-muted-foreground">Belum aktif di perangkat ini.</p>
            <Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={handleEnable}>
              {busy ? "Mengaktifkan…" : "Aktifkan"}
            </Button>
          </>
        )}
        {status === "subscribed" && (
          <>
            <p className="text-sm text-success">Aktif di perangkat ini.</p>
            <Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={handleDisable}>
              {busy ? "Menonaktifkan…" : "Nonaktifkan"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
