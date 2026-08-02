import { getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { sendWhatsappMessage } from "@/lib/wahub"

// Menghindari kirim pesan yang sama persis dua kali berturut-turut (per proses server).
let lastId: string | null = null

function pickMotivationMessage<T extends { id: string }>(messages: T[]) {
  if (messages.length === 1) return messages[0]
  let index = Math.floor(Math.random() * messages.length)
  while (messages[index].id === lastId) {
    index = Math.floor(Math.random() * messages.length)
  }
  return messages[index]
}

export async function runMotivationMessage() {
  const owner = await getWorkspaceOwner()
  if (!owner.phoneNumber) return

  const messages = await prisma.motivationMessage.findMany({
    where: { userId: owner.id, active: true },
  })
  if (messages.length === 0) return

  const message = pickMotivationMessage(messages)
  lastId = message.id

  try {
    await sendWhatsappMessage(owner.phoneNumber, message.content)
  } catch (error) {
    console.error("[cron] Gagal kirim pesan motivasi WA:", error)
  }
}
