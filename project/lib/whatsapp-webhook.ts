import type Anthropic from "@anthropic-ai/sdk"

import { runAgent } from "@/lib/agent"
import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber, sendWhatsappMessage } from "@/lib/wahub"

// Reset histori percakapan kalau nomor itu sudah idle lebih dari ini — supaya konteks lama
// tidak "nyangkut" ke topik baru yang tidak berhubungan.
const THREAD_IDLE_MS = 30 * 60 * 1000

interface WahubIncomingMessage {
  from?: string
  to?: string
  body?: string
  hasMedia?: boolean
}

interface WahubWebhookPayload {
  sessionId?: string
  message?: WahubIncomingMessage
}

/** Cuma nomor yang cocok dengan User.phoneNumber (sudah dinormalisasi) yang bisa dibalas AI. */
async function findRegisteredSender(rawFrom: string) {
  const digits = rawFrom.replace(/@.*$/, "")
  const normalized = normalizePhoneNumber(digits)

  const candidates = await prisma.user.findMany({ where: { phoneNumber: { not: null } } })
  const sender = candidates.find((u) => normalizePhoneNumber(u.phoneNumber!) === normalized)

  return { digits, sender }
}

export async function handleWhatsappWebhook(payload: WahubWebhookPayload) {
  const message = payload.message
  if (!message?.from) return { skipped: "no message" }

  // Baileys mengirim webhook untuk pesan masuk MAUPUN keluar (termasuk balasan bot sendiri).
  // "to" cuma berisi 'me' kalau pesan ini benar-benar masuk dari orang lain.
  if (message.to !== "me") return { skipped: "outgoing message" }
  if (!message.body?.trim()) return { skipped: "empty body" }

  const { digits, sender } = await findRegisteredSender(message.from)

  if (!sender) {
    await sendWhatsappMessage(
      digits,
      "Nomor kamu belum terdaftar di Director Daily Assistant, jadi belum bisa dibalas otomatis. Hubungi admin untuk didaftarkan dulu."
    )
    return { skipped: "unregistered number" }
  }

  const owner = await getWorkspaceOwner()

  const thread = await prisma.whatsappThread.findUnique({ where: { userId: sender.id } })
  const isFresh = thread && Date.now() - thread.updatedAt.getTime() < THREAD_IDLE_MS
  const history = isFresh ? (thread!.history as unknown as Anthropic.MessageParam[]) : undefined

  const { reply, messages } = await runAgent({
    ownerId: owner.id,
    actorId: sender.id,
    command: message.body.trim(),
    assistantInstructions: sender.assistantInstructions,
    history,
  })

  await prisma.whatsappThread.upsert({
    where: { userId: sender.id },
    update: { history: messages as unknown as object },
    create: { userId: sender.id, history: messages as unknown as object },
  })

  await sendWhatsappMessage(digits, reply)

  return { handled: true, user: sender.name }
}
