"use client"

import { useEffect, useState } from "react"
import { RefreshCw, TrendingUp } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockWatchesOverview } from "@/lib/stock-queries"

const POLL_INTERVAL_MS = 60_000

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`
}

function formatTime(iso: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso))
}

function criteriaLabel(watch: StockWatchesOverview["watches"][number]) {
  const parts: string[] = []
  if (watch.targetPrice != null) parts.push(`Target ${formatRupiah(watch.targetPrice)}`)
  if (watch.buyPrice != null && watch.targetPercent != null) {
    parts.push(`Untung ${watch.targetPercent}% dari ${formatRupiah(watch.buyPrice)}`)
  }
  return parts.join(" · ") || "-"
}

export function StockWatchPage({ initial }: { initial: StockWatchesOverview }) {
  const [overview, setOverview] = useState(initial)

  async function refresh() {
    try {
      const res = await fetch("/api/stock-watches")
      if (!res.ok) return
      setOverview(await res.json())
    } catch {
      // Diam saja — polling berikutnya coba lagi.
    }
  }

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="Bursa Saham"
          description="Watchlist saham IDX & histori harga. Sumber: Yahoo Finance, delay ~15-20 menit — bukan realtime detik-per-detik."
          icon={TrendingUp}
          action={
            <Button variant="secondary" size="sm" className="gap-2" onClick={refresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          }
        />

        {overview.watches.length === 0 ? (
          <Card className="glass-card border-0 ring-0">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Belum ada saham yang dipantau. Minta AI Assistant untuk mulai pantau, mis. &quot;pantau BBCA, jual di 9500&quot;.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
            {overview.watches.map((watch) => (
              <Card key={watch.id} className="glass-card border-0 ring-0">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{watch.ticker}</CardTitle>
                      {watch.companyName && <CardDescription>{watch.companyName}</CardDescription>}
                    </div>
                    <span className="text-xl font-semibold text-primary">
                      {watch.latestPrice != null ? formatRupiah(watch.latestPrice) : "-"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{criteriaLabel(watch)}</p>
                  {watch.latestCheckedAt && (
                    <p className="text-xs text-muted-foreground">Update terakhir: {formatTime(watch.latestCheckedAt)} WIB</p>
                  )}

                  {watch.history.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[280px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Waktu</th>
                            <th className="py-2 font-medium">Harga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {watch.history.map((h, i) => (
                            <tr key={i} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-3 text-muted-foreground">{formatTime(h.checkedAt)}</td>
                              <td className="py-2 font-medium">{formatRupiah(h.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
