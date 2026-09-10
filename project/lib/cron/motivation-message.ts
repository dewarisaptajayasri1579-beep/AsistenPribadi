import { getAllWorkspaceOwners } from "@/lib/current-user"
import { rephraseMotivationMessage } from "@/lib/motivation-ai"
import { prisma } from "@/lib/prisma"
import { sendWhatsappMessage } from "@/lib/wahub"

// Menghindari kirim pesan yang sama persis dua kali berturut-turut (per proses server).
// Disimpan PER DIREKTUR: kalau satu variabel dipakai bersama, pesan terakhir milik direktur A
// ikut membatasi pilihan direktur B — padahal koleksi motivasi mereka sama sekali berbeda.
const lastIdByOwner = new Map<string, string>()

function pickMotivationMessage<T extends { id: string }>(messages: T[], lastId: string | undefined) {
  if (messages.length === 1) return messages[0]
  let index = Math.floor(Math.random() * messages.length)
  while (messages[index].id === lastId) {
    index = Math.floor(Math.random() * messages.length)
  }
  return messages[index]
}

export async function runMotivationMessage() {
  for (const owner of await getAllWorkspaceOwners()) {
    try {
      await sendMotivationFor(owner.id, owner.phoneNumber)
    } catch (error) {
      console.error(`[cron] pesan motivasi gagal untuk ${owner.name}:`, error)
    }
  }
}

async function sendMotivationFor(ownerId: string, phoneNumber: string | null) {
  if (!phoneNumber) return

  const messages = await prisma.motivationMessage.findMany({
    where: { userId: ownerId, active: true },
  })
  if (messages.length === 0) return

  const message = pickMotivationMessage(messages, lastIdByOwner.get(ownerId))
  lastIdByOwner.set(ownerId, message.id)

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
    await sendWhatsappMessage(phoneNumber, content)
  } catch (error) {
    console.error("[cron] Gagal kirim pesan motivasi WA:", error)
  }
}
