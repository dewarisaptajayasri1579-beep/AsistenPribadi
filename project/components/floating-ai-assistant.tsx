"use client"

import { useEffect, useState } from "react"
import { Bot, CheckCircle2, Mic, Send, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { quickActions } from "@/lib/dashboard-data"
import { useSpeechInput } from "@/components/use-speech-input"
import { VoiceRecordingBar } from "@/components/voice-recording-bar"

interface FloatingMessage {
  role: "assistant" | "user"
  text: string
  model?: string
}

export function FloatingAiAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [messages, setMessages] = useState<FloatingMessage[]>([
    { role: "assistant", text: "Selamat datang. Ada yang bisa saya bantu untuk agenda hari ini?" },
  ])
  const [history, setHistory] = useState<unknown[]>([])
  const speech = useSpeechInput((transcript) => {
    const combined = input ? `${input} ${transcript}` : transcript
    setInput("")
    handleSend(combined)
  })

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.name) return
        setMessages([
          { role: "assistant", text: `Selamat datang, ${data.name}. Ada yang bisa saya bantu untuk agenda hari ini?` },
        ])
      })
      .catch(() => {})
  }, [])

  async function handleSend(overrideCommand?: string) {
    const command = (overrideCommand ?? input).trim()
    if (!command || pending) return

    setMessages((current) => [...current, { role: "user", text: command }])
    setInput("")
    setPending(true)
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, history }),
      })
      const data = await res.json()
      const reply = res.ok ? data.reply : `Terjadi kesalahan: ${data.error ?? "tidak diketahui"}`
      setMessages((current) => [...current, { role: "assistant", text: reply, model: data.model }])
      if (res.ok && Array.isArray(data.history)) setHistory(data.history)
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Gagal menghubungi agent. Coba lagi." }])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed right-3 bottom-3 flex max-w-[calc(100vw-24px)] flex-col items-end gap-3 sm:right-6 sm:bottom-6 sm:max-w-none">
      {open && (
        <section
          aria-label="AI Assistant floating"
          className="flex h-[min(580px,calc(100dvh-100px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-primary/35 bg-popover shadow-[0_0_48px_-16px_var(--neon-glow),0_24px_70px_-28px_oklch(0_0_0/90%)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-primary/20 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary shadow-[0_0_22px_var(--neon-glow)]">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">AI Assistant</h2>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 text-success" aria-hidden="true" />
                  Aktif dan siap membantu
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setOpen(false)}
              aria-label="Tutup AI Assistant"
            >
              <X />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Percakapan baru
            </div>
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div
                  key={index}
                  className="ml-8 rounded-2xl rounded-br-md border border-primary/35 bg-primary/70 p-3 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-[0_0_20px_var(--neon-glow)]"
                >
                  {message.text}
                </div>
              ) : (
                <div key={index} className="mr-6 flex flex-col gap-1">
                  <div className="rounded-2xl rounded-tl-md border border-border bg-secondary/45 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {message.text}
                  </div>
                  {message.model && <span className="pl-1 text-xs text-muted-foreground">{message.model}</span>}
                </div>
              )
            )}
            {pending && (
              <div className="mr-6 rounded-2xl rounded-tl-md border border-border bg-secondary/45 p-3 text-sm leading-relaxed text-muted-foreground">
                Sedang memproses…
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-primary/15 px-4 py-3">
            {quickActions.slice(0, 3).map((action) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-full bg-secondary/30 px-3 font-normal"
                onClick={() => setInput(action)}
              >
                {action}
              </Button>
            ))}
          </div>

          <div className="p-3 pt-0">
            <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-secondary/35 p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
              {speech.isListening ? (
                <VoiceRecordingBar level={speech.level} onStop={speech.toggle} />
              ) : (
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return
                    if (event.key === "Enter") handleSend()
                  }}
                  className="h-10 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
                  placeholder="Ketik perintah Anda..."
                  aria-label="Perintah untuk floating AI Assistant"
                  disabled={pending}
                />
              )}
              {speech.isSupported && !speech.isListening && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-10 shrink-0 rounded-full"
                  onClick={speech.toggle}
                  aria-label="Rekam suara"
                  aria-pressed={speech.isListening}
                  disabled={pending}
                >
                  <Mic />
                </Button>
              )}
              {!speech.isListening && (
                <Button
                  type="button"
                  size="icon"
                  className="size-10 shrink-0 rounded-full shadow-[0_0_18px_var(--neon-glow)]"
                  onClick={() => handleSend()}
                  aria-label="Kirim perintah floating"
                  disabled={pending}
                >
                  <Send />
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <Button
        type="button"
        size="lg"
        className="size-14 rounded-full border border-primary/50 p-0 shadow-[0_0_30px_var(--neon-glow)] sm:size-16"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Tutup AI Assistant" : "Buka AI Assistant"}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </Button>
    </div>
  )
}
