import { CircleDollarSign, MessagesSquare, Receipt, Zap } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiUsageOverview } from "@/lib/usage-queries"
import { formatIdr, modelLabel } from "@/lib/pricing"

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function truncate(text: string, max = 50) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function AiUsagePage({ overview }: { overview: AiUsageOverview }) {
  const { logs, today, allTime } = overview
  const avgCostUsd = allTime.count > 0 ? allTime.totalCostUsd / allTime.count : 0

  const stats = [
    { label: "Biaya Hari Ini", value: formatIdr(today.totalCostUsd), detail: `${today.count} chat`, icon: CircleDollarSign },
    { label: "Biaya Total", value: formatIdr(allTime.totalCostUsd), detail: `${allTime.count} chat sepanjang waktu`, icon: Receipt },
    { label: "Rata-rata per Chat", value: formatIdr(avgCostUsd), detail: "Termasuk semua tool call", icon: Zap },
    { label: "Total API Call", value: String(allTime.totalApiCalls), detail: "Sepanjang waktu", icon: MessagesSquare },
  ]

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="Biaya AI"
          description="Pantau token dan estimasi biaya setiap chat dengan AI Agent."
          icon={CircleDollarSign}
        />

        <section aria-label="Ringkasan biaya" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, detail, icon: Icon }) => (
            <Card key={label} className="glass-card border-0 ring-0">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="truncate text-xl font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="glass-card border-0 ring-0">
          <CardHeader>
            <CardTitle>Riwayat Chat</CardTitle>
            <CardDescription>50 chat terakhir dengan AI Agent.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada riwayat chat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Waktu</th>
                      <th className="py-2 pr-3 font-medium">Model</th>
                      <th className="py-2 pr-3 font-medium">Perintah</th>
                      <th className="py-2 pr-3 font-medium">Token In/Out</th>
                      <th className="py-2 pr-3 font-medium">Cache</th>
                      <th className="py-2 pr-3 font-medium">API Call</th>
                      <th className="py-2 pr-3 font-medium">Durasi</th>
                      <th className="py-2 pr-0 text-right font-medium">Biaya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">{formatTime(log.createdAt)}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                            {modelLabel(log.model)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-foreground/85" title={log.command}>
                          {truncate(log.command)}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                          {log.inputTokens.toLocaleString("id-ID")} / {log.outputTokens.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                          {log.cacheReadTokens > 0 ? log.cacheReadTokens.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">{log.apiCallCount}x</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                          {(log.durationMs / 1000).toFixed(1)}s
                        </td>
                        <td className="py-2.5 pr-0 text-right font-medium whitespace-nowrap">{formatIdr(log.estimatedCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
