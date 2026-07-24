"use client"

import { useState } from "react"
import { Bot, Send, Sparkles } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PageHeading } from "@/components/page-heading"
import { quickActions } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type ChatMessage = { role: "user" | "assistant"; text: string; model?: string }

interface AssistantPageProps {
  userName: string
}

export function AssistantPage({ userName }: AssistantPageProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Halo ${userName}, ada yang bisa saya bantu hari ini?` },
  ])
  const [pending, setPending] = useState(false)

  async function handleSend() {
    const command = input.trim()
    if (!command || pending) return
    setMessages((current) => [...current, { role: "user", text: command }])
    setInput("")
    setPending(true)
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      const reply = res.ok ? data.reply : `Terjadi kesalahan: ${data.error ?? "tidak diketahui"}`
      setMessages((current) => [...current, { role: "assistant", text: reply, model: data.model }])
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Gagal menghubungi agent. Coba lagi." }])
    } finally {
      setPending(false)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeading
          title="AI Assistant"
          description="Ngobrol dengan asisten untuk mengatur jadwal, tugas, dan pengingat."
          icon={Bot}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)] xl:gap-5">
          <Card className="glass-card flex min-h-[520px] flex-col border-0 ring-0">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Percakapan</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div
                      key={index}
                      className="ml-6 rounded-2xl rounded-br-md bg-primary/70 p-3 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground sm:ml-12"
                    >
                      {message.text}
                    </div>
                  ) : (
                    <div key={index} className="mr-6 flex flex-col gap-1 sm:mr-12">
                      <div className="rounded-2xl rounded-tl-md border border-border bg-secondary/40 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                        {message.text}
                      </div>
                      {message.model && <span className="pl-1 text-xs text-muted-foreground">{message.model}</span>}
                    </div>
                  )
                )}
                {pending && (
                  <div className="mr-6 rounded-2xl rounded-tl-md border border-border bg-secondary/40 p-3 text-sm leading-relaxed text-muted-foreground sm:mr-12">
                    Sedang memproses…
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-input bg-secondary/30 p-2 focus-within:ring-2 focus-within:ring-ring/50">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return
                    if (event.key === "Enter") handleSend()
                  }}
                  className="h-10 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
                  placeholder="Ketik perintah Anda..."
                  aria-label="Perintah untuk AI Assistant"
                  disabled={pending}
                />
                <Button size="icon" className="shrink-0 rounded-full" onClick={handleSend} aria-label="Kirim perintah" disabled={pending}>
                  <Send />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="glass-card border-0 ring-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" />
                  Perintah Cepat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    className="h-auto min-h-11 justify-start rounded-xl px-3 py-2.5 text-left text-sm font-normal"
                    onClick={() => setInput(action)}
                  >
                    <span className="text-pretty">{action}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
