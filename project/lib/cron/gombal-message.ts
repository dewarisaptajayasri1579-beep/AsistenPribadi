import { jakartaTodayDateIso } from "@/lib/datetime"
import { getWorkspaceOwner } from "@/lib/current-user"
import { generateGombalMessage } from "@/lib/gombal-ai"
import { sendWhatsappMessage } from "@/lib/wahub"

// Dipanggil tiap tick (lihat instrumentation.ts, tiap 20 menit jam 07:00-22:00 WIB) — bukan jam
// tetap, supaya kerasa surprise. Target harian diacak 4-6x, disebar lewat probabilitas per tick
// (bukan precompute jam-jam acak di awal hari) supaya tahan kalau server restart di tengah hari.
const TICK_PROBABILITY = 1 / 9 // ~45 tick/hari (jendela 15 jam / 20 menit) * 1/9 ≈ 5x/hari
const MIN_GAP_MS = 45 * 60 * 1000

let state = { date: "", target: 0, count: 0, lastSentAt: 0 }

function rollDailyTarget() {
  return 4 + Math.floor(Math.random() * 3) // 4, 5, atau 6
}

export async function runGombalMessage() {
  const today = jakartaTodayDateIso()
  if (state.date !== today) {
    state = { date: today, target: rollDailyTarget(), count: 0, lastSentAt: 0 }
  }

  if (state.count >= state.target) return
  if (state.lastSentAt && Date.now() - state.lastSentAt < MIN_GAP_MS) return
  if (Math.random() > TICK_PROBABILITY) return

  const owner = await getWorkspaceOwner()
  if (!owner.phoneNumber) return

  let content: string
  try {
    content = await generateGombalMessage()
  } catch (error) {
    console.error("[cron] Gagal generate gombalan, skip kirim:", error)
    return
  }

  try {
    await sendWhatsappMessage(owner.phoneNumber, content)
    state.count += 1
    state.lastSentAt = Date.now()
  } catch (error) {
    console.error("[cron] Gagal kirim gombalan WA:", error)
  }
}
