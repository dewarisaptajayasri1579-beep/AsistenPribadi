"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const POLL_INTERVAL_MS = 4000

interface ThreadContentBlock {
  type: string
  text?: string
  name?: string
  input?: unknown
  content?: unknown
}

interface ThreadMessage {
  role: "user" | "assistant"
  content: string | ThreadContentBlock[]
}

function renderContent(content: ThreadMessage["content"]) {
  if (typeof content === "string") return content

  return content
    .map((block) => {
      if (block.type === "text") return block.text ?? ""
      if (block.type === "tool_use") return `🔧 memanggil tool: ${block.name}(${JSON.stringify(block.input)})`
      if (block.type === "tool_result") return `↩ hasil tool: ${JSON.stringify(block.content)}`
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

interface WaTestPanelProps {
  phoneNumber: string
}

export function WaTestPanel({ phoneNumber }: WaTestPanelProps) {
  const [message, setMessage] = useState("✅ Tes WAHUB dari halaman uji coba — kalau ini masuk, integrasi WA berfungsi normal.")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function refreshThread() {
    try {
      const res = await fetch("/api/whatsapp/thread")
      if (!res.ok) return
      const data = await res.json()
      setMessages(Array.isArray(data.history) ? data.history : [])
      setUpdatedAt(data.updatedAt)
    } catch {
      // Diam saja — polling berikutnya akan coba lagi.
    }
  }

  useEffect(() => {
    refreshThread()
    pollRef.current = setInterval(refreshThread, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleSend() {
    if (!message.trim() || sending) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch("/api/whatsapp/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      setSendResult(res.ok ? "Terkirim ke WhatsApp kamu." : `Gagal: ${data.error ?? "tidak diketahui"}`)
    } catch {
      setSendResult("Gagal menghubungi server.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="glass-card rounded-2xl p-5">
        <h2 className="mb-1 text-base font-semibold">Kirim pesan test</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Mengirim pesan WhatsApp langsung ke nomor terdaftar ({phoneNumber || "belum diatur"}) lewat WAHUB, tanpa lewat AI Agent.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Isi pesan test..."
            disabled={sending || !phoneNumber}
          />
          <Button type="button" onClick={handleSend} disabled={sending || !phoneNumber} className="shrink-0 gap-2">
            <Send className="size-4" />
            Kirim
          </Button>
        </div>
        {sendResult && <p className="mt-3 text-sm text-muted-foreground">{sendResult}</p>}
      </section>

      <section className="glass-card rounded-2xl p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold">Percakapan WhatsApp (live)</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={refreshThread} aria-label="Muat ulang">
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Menampilkan histori percakapan yang ditangkap webhook WA nyata (auto-refresh tiap {POLL_INTERVAL_MS / 1000} detik).
          Balas pesan test di atas lewat HP kamu, lalu lihat balasannya muncul di sini.
        </p>
        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada percakapan WA yang tercatat.</p>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={
                msg.role === "user"
                  ? "ml-8 rounded-2xl rounded-br-md border border-primary/35 bg-primary/70 p-3 text-sm whitespace-pre-wrap text-primary-foreground"
                  : "mr-8 rounded-2xl rounded-tl-md border border-border bg-secondary/45 p-3 text-sm whitespace-pre-wrap text-foreground/90"
              }
            >
              {renderContent(msg.content)}
            </div>
          ))}
        </div>
        {updatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">Terakhir diperbarui: {new Date(updatedAt).toLocaleString("id-ID")}</p>
        )}
      </section>
    </div>
  )
}
