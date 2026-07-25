import { useState } from "react"
import {
  Bell,
  Bot,
  CalendarDays,
  ListTodo,
  Mic,
  Send,
} from "lucide-react"

import { quickActions } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSpeechInput } from "@/components/use-speech-input"
import { VoiceRecordingBar } from "@/components/voice-recording-bar"

const quickActionIcons = [CalendarDays, ListTodo, Bell]

type ChatMessage = { role: "user" | "assistant"; text: string; model?: string }

interface AiAssistantPanelProps {
  userName: string
}

export function AiAssistantPanel({ userName }: AiAssistantPanelProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Halo ${userName}, ada yang bisa saya bantu hari ini?` },
  ])
  const [history, setHistory] = useState<unknown[]>([])
  const [pending, setPending] = useState(false)
  const speech = useSpeechInput((transcript) => setInput((current) => (current ? `${current} ${transcript}` : transcript)))

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
    <aside className="glass-card flex min-h-[560px] w-full shrink-0 flex-col rounded-[18px] p-4 sm:p-5 min-[1400px]:sticky min-[1400px]:top-6 min-[1400px]:h-[calc(100vh-48px)] min-[1400px]:w-[340px]">
      <header className="flex items-center gap-3 pb-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Bot className="size-5" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">AI Assistant</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div
              key={index}
              className="ml-4 rounded-2xl rounded-br-md border border-primary/40 bg-primary/70 p-4 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-[0_0_22px_var(--neon-glow)] sm:ml-8"
            >
              {message.text}
            </div>
          ) : (
            <div key={index} className="mr-5 flex flex-col gap-1">
              <div className="rounded-2xl rounded-tl-md border border-border bg-secondary/45 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                {message.text}
              </div>
              {message.model && <span className="pl-1 text-xs text-muted-foreground">{message.model}</span>}
            </div>
          )
        )}
        {pending && (
          <div className="mr-5 rounded-2xl rounded-tl-md border border-border bg-secondary/45 p-4 text-sm leading-relaxed text-muted-foreground">
            Sedang memproses…
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/20 p-4">
          <h3 className="text-[15px] font-semibold">Aksi Cepat</h3>
          <div className="flex flex-col gap-2">
            {quickActions.map((action, index) => {
              const Icon = quickActionIcons[index]
              return (
                <Button
                  key={action}
                  variant="outline"
                  className="h-auto min-h-11 justify-start rounded-xl px-3 py-2.5 text-left text-sm font-normal"
                  onClick={() => setInput(action)}
                >
                  <Icon data-icon="inline-start" />
                  <span className="text-pretty">{action}</span>
                </Button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-input bg-secondary/30 p-2 focus-within:ring-2 focus-within:ring-ring/50">
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
              aria-label="Perintah untuk AI Assistant"
            />
          )}
          {speech.isSupported && !speech.isListening && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 rounded-full"
              onClick={speech.toggle}
              aria-label="Rekam suara"
              aria-pressed={speech.isListening}
            >
              <Mic />
            </Button>
          )}
          {!speech.isListening && (
            <Button size="icon" className="shrink-0 rounded-full" onClick={handleSend} aria-label="Kirim perintah">
              <Send />
            </Button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Contoh: “Ingatkan saya follow-up Yamada-san”
        </p>
      </div>
    </aside>
  )
}
