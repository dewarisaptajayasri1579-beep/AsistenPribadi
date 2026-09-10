"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SessionInfo {
  mode: "shared" | "own"
  status?: string
  phoneNumber?: string | null
  qr?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  READY: "Tersambung",
  QR_READY: "Menunggu QR di-scan",
  STARTING: "Menyiapkan…",
  DISCONNECTED: "Terputus",
  FAILED: "Gagal tersambung",
  UNKNOWN: "Belum diketahui",
}

export function WhatsappNumberCard() {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/whatsapp/session")
    if (!res.ok) return
    setInfo(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Selama menunggu QR di-scan, statusnya berubah di sisi WAHUB tanpa memberi tahu kita — dan QR
  // WhatsApp sendiri kedaluwarsa dalam hitungan puluhan detik. Jadi selama fase itu saja kita
  // polling; begitu tersambung, polling berhenti.
  useEffect(() => {
    if (info?.mode !== "own") return
    if (info.status !== "QR_READY" && info.status !== "STARTING") return

    timer.current = setTimeout(load, 5000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [info, load])

  async function setMode(mode: "shared" | "own") {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/whatsapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Gagal mengubah pengaturan nomor")
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="glass-card border-0 ring-0 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" aria-hidden="true" />
          Nomor WhatsApp Naya
        </CardTitle>
        <CardDescription>
          Naya bisa numpang nomor bersama, atau pakai nomor khusus milikmu sendiri.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {info?.mode === "shared" && (
          <>
            <p className="text-sm text-muted-foreground">
              Saat ini Naya memakai <strong>nomor bersama</strong>. Kamu tinggal chat ke nomor itu
              dan Naya otomatis tahu itu kamu dari nomor pengirimnya.
            </p>
            <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Mau pakai nomor sendiri?</p>
              <p>
                Siapkan <strong>nomor WhatsApp khusus</strong> untuk Naya — bukan nomor pribadimu
                sehari-hari. Kalau nomor pribadimu yang dipakai, kamu harus chat ke dirimu sendiri
                untuk bicara dengan Naya, dan seluruh chat pribadimu ikut mengalir lewat server ini.
              </p>
            </div>
            <Button type="button" className="self-start rounded-xl" disabled={busy} onClick={() => setMode("own")}>
              Pakai nomor sendiri
            </Button>
          </>
        )}

        {info?.mode === "own" && (
          <>
            <p className="text-sm">
              Status: <strong>{STATUS_LABEL[info.status ?? "UNKNOWN"] ?? info.status}</strong>
              {info.phoneNumber && <span className="text-muted-foreground"> · {info.phoneNumber}</span>}
            </p>

            {info.qr && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Buka WhatsApp di HP nomor khusus itu → Perangkat Tertaut → Tautkan Perangkat, lalu
                  scan QR ini. QR berganti otomatis kalau kedaluwarsa.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={info.qr} alt="QR login WhatsApp" className="size-56 rounded-xl bg-white p-2" />
              </div>
            )}

            {info.status === "FAILED" || info.status === "DISCONNECTED" ? (
              <Button type="button" className="self-start rounded-xl" disabled={busy} onClick={() => setMode("own")}>
                <RefreshCw data-icon="inline-start" />
                Sambungkan ulang
              </Button>
            ) : null}

            <Button type="button" variant="outline" className="self-start rounded-xl" disabled={busy} onClick={() => setMode("shared")}>
              Kembali numpang nomor bersama
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
