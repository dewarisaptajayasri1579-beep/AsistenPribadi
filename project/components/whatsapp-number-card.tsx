"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SessionInfo {
  mode: "shared" | "own"
  status?: string
  phoneNumber?: string | null
  qr?: string | null
}

// Nilai yang benar-benar dipakai WAHUB — lihat src/sessionManager.js di backend-wahub.
// (Jangan menebak: "STARTING" tidak pernah ada di sana.)
const STATUS_LABEL: Record<string, string> = {
  READY: "Tersambung",
  QR_READY: "Menunggu QR di-scan",
  INITIALIZING: "Menyiapkan koneksi…",
  DISCONNECTED: "Terputus, mencoba menyambung ulang…",
  FAILED: "Gagal tersambung",
  UNKNOWN: "Belum diketahui",
}

export function WhatsappNumberCard() {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  /** Ambil status terbaru. Sengaja TIDAK melempar error: pemanggilnya adalah loop polling, dan
   *  satu blip jaringan tidak boleh mematikan loop itu. Mengembalikan info terbaru supaya si
   *  loop bisa menentukan jeda berikutnya tanpa menunggu state ter-render. */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/session", { cache: "no-store" })
      if (!res.ok) return null
      const data = (await res.json()) as SessionInfo
      setInfo(data)
      return data
    } catch {
      return null
    }
  }, [])

  // WAHUB tidak pernah memberi tahu kita saat statusnya berubah — satu-satunya cara tahu adalah
  // bertanya terus. Dua hal yang wajib dijaga di sini:
  //   1. Polling TIDAK boleh berhenti saat READY. Sesi bisa putus sendiri (HP mati, WhatsApp
  //      melepas perangkat tertaut), dan kartu yang berhenti memeriksa akan memajang "Tersambung"
  //      yang bohong sampai halamannya di-reload manual.
  //   2. Jadwal berikutnya dipasang oleh loop ini sendiri, bukan oleh perubahan `info`. Versi
  //      sebelumnya bergantung pada `info` berubah; begitu satu fetch gagal, `info` tetap sama,
  //      efeknya tidak jalan lagi, dan polling mati permanen.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (data: SessionInfo | null) => {
      if (cancelled) return
      // Belum tersambung: QR WhatsApp kedaluwarsa dalam hitungan puluhan detik, jadi periksa
      // cepat. Sudah tersambung: cukup pelan, ini hanya untuk menangkap sesi yang putus.
      const delay = data?.mode === "own" && data.status !== "READY" ? 4000 : 20000
      timer = setTimeout(tick, delay)
    }

    const tick = async () => {
      // Tab di background: browser meng-throttle timer sampai ~1 menit sekali, dan requestnya pun
      // mubazir karena tidak ada yang melihat. Biarkan 'visibilitychange' di bawah yang menyusul.
      if (document.hidden) return schedule(null)
      schedule(await load())
    }

    tick()

    // Alur normalnya: buka halaman ini → pindah ke HP untuk scan QR → balik ke tab. Tanpa ini,
    // yang dilihat saat balik adalah status basi, dan satu-satunya jalan adalah refresh manual.
    const onWake = () => {
      if (document.hidden) return
      if (timer) clearTimeout(timer)
      tick()
    }
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("focus", onWake)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("focus", onWake)
    }
  }, [load])

  async function refreshNow() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

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
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Status: <strong>{STATUS_LABEL[info.status ?? "UNKNOWN"] ?? info.status}</strong>
                {info.phoneNumber && <span className="text-muted-foreground"> · {info.phoneNumber}</span>}
              </span>
              <button
                type="button"
                onClick={refreshNow}
                disabled={refreshing}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                {refreshing ? "Memeriksa…" : "Perbarui"}
              </button>
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

            {/* Selama belum tersambung & QR belum keluar, sediakan jalan keluar manual — sesi
                WAHUB kadang nyangkut di INITIALIZING/DISCONNECTED dan tidak pulih sendiri. */}
            {info.status !== "READY" && info.status !== "QR_READY" && (
              <Button type="button" className="self-start rounded-xl" disabled={busy} onClick={() => setMode("own")}>
                <RefreshCw data-icon="inline-start" />
                Coba sambungkan lagi
              </Button>
            )}

            <Button type="button" variant="outline" className="self-start rounded-xl" disabled={busy} onClick={() => setMode("shared")}>
              Kembali numpang nomor bersama
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
