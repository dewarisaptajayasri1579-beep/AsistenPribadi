import { jakartaTodayDateIso } from "@/lib/datetime"
import { getAllWorkspaceOwners } from "@/lib/current-user"
import { generateGombalMessage } from "@/lib/gombal-ai"
import { sapaanOf } from "@/lib/sapaan"
import { sendWhatsappMessage } from "@/lib/wahub"

// Dipanggil tiap tick (lihat instrumentation.ts, tiap 20 menit jam 07:00-22:00 WIB) — bukan jam
// tetap, supaya kerasa surprise. Target harian diacak 4-6x, disebar lewat probabilitas per tick
// (bukan precompute jam-jam acak di awal hari) supaya tahan kalau server restart di tengah hari.
const TICK_PROBABILITY = 1 / 9 // ~45 tick/hari (jendela 15 jam / 20 menit) * 1/9 ≈ 5x/hari
const MIN_GAP_MS = 45 * 60 * 1000

interface GombalState {
  date: string
  target: number
  count: number
  lastSentAt: number
}

// State-nya PER DIREKTUR. Kalau satu variabel dipakai bersama, "4-6x sehari" jadi jatah kolektif:
// gombalan untuk direktur A menaikkan count yang sama, dan MIN_GAP_MS-nya ikut memblokir direktur
// B — jadi makin banyak direktur, makin sedikit yang masing-masing terima.
const stateByOwner = new Map<string, GombalState>()

function rollDailyTarget() {
  return 4 + Math.floor(Math.random() * 3) // 4, 5, atau 6
}

export async function runGombalMessage() {
  const today = jakartaTodayDateIso()

  for (const owner of await getAllWorkspaceOwners()) {
    try {
      await maybeSendGombalFor(owner.id, owner.phoneNumber, sapaanOf(owner), today)
    } catch (error) {
      console.error(`[cron] gombalan gagal untuk ${owner.name}:`, error)
    }
  }
}

async function maybeSendGombalFor(ownerId: string, phoneNumber: string | null, sapaan: string, today: string) {
  if (!phoneNumber) return

  let state = stateByOwner.get(ownerId)
  if (!state || state.date !== today) {
    state = { date: today, target: rollDailyTarget(), count: 0, lastSentAt: 0 }
    stateByOwner.set(ownerId, state)
  }

  if (state.count >= state.target) return
  if (state.lastSentAt && Date.now() - state.lastSentAt < MIN_GAP_MS) return
  // Diundi terpisah tiap direktur, jadi jam kirimnya juga tidak barengan.
  if (Math.random() > TICK_PROBABILITY) return

  let content: string
  try {
    content = await generateGombalMessage(sapaan)
  } catch (error) {
    console.error("[cron] Gagal generate gombalan, skip kirim:", error)
    return
  }

  try {
    await sendWhatsappMessage(phoneNumber, content)
    state.count += 1
    state.lastSentAt = Date.now()
  } catch (error) {
    console.error("[cron] Gagal kirim gombalan WA:", error)
  }
}
