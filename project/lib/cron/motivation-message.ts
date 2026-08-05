import { getWorkspaceOwner } from "@/lib/current-user"
import { rephraseMotivationMessage } from "@/lib/motivation-ai"
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

  // Rangkai ulang jadi variasi kalimat baru tiap kirim (tema/makna sama, kata-kata beda) —
  // supaya tidak kerasa ngulang-ngulang persis. Kalau AI gagal, tetap kirim isi aslinya
  // daripada gagal kirim sama sekali.
  let content = message.content
  try {
    content = await rephraseMotivationMessage(message.content)
  } catch (error) {
    console.error("[cron] Gagal merangkai variasi pesan motivasi, kirim isi asli:", error)
  }

  try {
    await sendWhatsappMessage(owner.phoneNumber, content)
  } catch (error) {
    console.error("[cron] Gagal kirim pesan motivasi WA:", error)
  }
}
