import type Anthropic from "@anthropic-ai/sdk"

import { runAgent } from "@/lib/agent"
import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber, sendWhatsappMessage } from "@/lib/wahub"

// Reset histori percakapan kalau nomor itu sudah idle lebih dari ini — supaya konteks lama
// tidak "nyangkut" ke topik baru yang tidak berhubungan.
const THREAD_IDLE_MS = 30 * 60 * 1000

/** Pesan WA yang diawali "##" langsung disimpan sebagai motivasi baru, tanpa lewat AI Agent
 *  (deterministik & hemat kuota Claude). Format: "## Judul, isi motivasi" — judul & koma opsional. */
function parseMotivationShortcut(body: string) {
  if (!body.startsWith("##")) return null

  const rest = body.slice(2).trim()
  if (!rest) return null

  const commaIndex = rest.indexOf(",")
  if (commaIndex === -1) return { label: null, content: rest }

  const label = rest.slice(0, commaIndex).trim()
  const content = rest.slice(commaIndex + 1).trim()
  if (!content) return { label: null, content: rest }

  return { label: label || null, content }
}

interface WahubIncomingMessage {
  from?: string
  senderNumber?: string
  senderName?: string | null
  to?: string
  body?: string
  hasMedia?: boolean
  mediaBase64?: string | null
  mimetype?: string | null
}

interface WahubWebhookPayload {
  sessionId?: string
  message?: WahubIncomingMessage
}

/** Cuma nomor yang cocok dengan User.phoneNumber (sudah dinormalisasi) yang bisa dibalas AI. */
async function findRegisteredSender(rawNumber: string) {
  const normalized = normalizePhoneNumber(rawNumber)

  const candidates = await prisma.user.findMany({ where: { phoneNumber: { not: null } } })
  return candidates.find((u) => normalizePhoneNumber(u.phoneNumber!) === normalized)
}

export async function handleWhatsappWebhook(payload: WahubWebhookPayload) {
  const message = payload.message
  console.log("[whatsapp webhook] payload masuk:", JSON.stringify(payload))

  if (!message?.from) {
    console.log("[whatsapp webhook] skip: no message")
    return { skipped: "no message" }
  }

  // Baileys mengirim webhook untuk pesan masuk MAUPUN keluar (termasuk balasan bot sendiri).
  // "to" cuma berisi 'me' kalau pesan ini benar-benar masuk dari orang lain.
  if (message.to !== "me") {
    console.log("[whatsapp webhook] skip: outgoing message, to=", message.to)
    return { skipped: "outgoing message" }
  }
  if (!message.body?.trim()) {
    console.log("[whatsapp webhook] skip: empty body")
    return { skipped: "empty body" }
  }

  const digits = message.senderNumber || message.from.replace(/@.*$/, "")
  const sender = await findRegisteredSender(digits)

  // Nomor tidak dikenal: diam saja, jangan dibalas apapun (hindari spam/bot-fishing & hemat kuota WA).
  if (!sender) {
    console.log("[whatsapp webhook] skip: nomor tak terdaftar, digits=", digits)
    return { skipped: "unregistered number" }
  }

  console.log("[whatsapp webhook] diproses untuk user:", sender.name, "command:", message.body.trim())

  const owner = await getWorkspaceOwner()

  const motivationShortcut = parseMotivationShortcut(message.body.trim())
  if (motivationShortcut) {
    await prisma.motivationMessage.create({
      data: {
        userId: owner.id,
        label: motivationShortcut.label,
        content: motivationShortcut.content,
        source: "whatsapp",
      },
    })

    const confirmation = motivationShortcut.label
      ? `✅ Motivasi baru tersimpan: "${motivationShortcut.label}".`
      : "✅ Motivasi baru tersimpan."
    await sendWhatsappMessage(digits, confirmation)

    return { handled: true, motivationAdded: true }
  }

  const thread = await prisma.whatsappThread.findUnique({ where: { userId: sender.id } })
  const isFresh = thread && Date.now() - thread.updatedAt.getTime() < THREAD_IDLE_MS
  const history = isFresh ? (thread!.history as unknown as Anthropic.MessageParam[]) : undefined

  // Placeholder dari WAHUB kalau foto dikirim tanpa caption — tidak berguna dikirim apa adanya
  // ke AI, ganti dengan instruksi baca nota yang jelas.
  const bodyTrimmed = message.body.trim()
  const command =
    message.mediaBase64 && bodyTrimmed === "[MEDIA Image]"
      ? "Tolong baca foto ini. Kalau ini nota/struk belanja, ekstrak & catat sebagai transaksi (record_transaction) sesuai isinya."
      : bodyTrimmed

  const { reply, messages } = await runAgent({
    ownerId: owner.id,
    actorId: sender.id,
    command,
    assistantInstructions: sender.assistantInstructions,
    history,
    image: message.mediaBase64 ? { base64: message.mediaBase64, mimeType: message.mimetype || "image/jpeg" } : undefined,
  })

  await prisma.whatsappThread.upsert({
    where: { userId: sender.id },
    update: { history: messages as unknown as object },
    create: { userId: sender.id, history: messages as unknown as object },
  })

  await sendWhatsappMessage(digits, reply)

  return { handled: true, user: sender.name }
}
