const WAHUB_BASE_URL = process.env.WAHUB_BASE_URL
const WAHUB_API_KEY = process.env.WAHUB_API_KEY

/** Ubah nomor lokal (08...) jadi format internasional (62...) yang dipakai WAHUB. */
export function normalizePhoneNumber(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "")
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  return digits
}

export async function sendWhatsappMessage(rawNumber: string, message: string) {
  if (!WAHUB_BASE_URL || !WAHUB_API_KEY) {
    throw new Error("WAHUB_BASE_URL / WAHUB_API_KEY belum di-set")
  }

  const number = normalizePhoneNumber(rawNumber)

  const res = await fetch(`${WAHUB_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": WAHUB_API_KEY },
    body: JSON.stringify({ number, message }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`WAHUB gagal kirim (${res.status}): ${text.slice(0, 200)}`)
  }

  return res.json() as Promise<{ success: boolean }>
}

/** Daftarkan ulang webhook URL sesi WAHUB pakai env var yang sedang aktif — dipanggil sekali
 *  tiap kali server start (lihat instrumentation.ts), supaya webhook otomatis ter-sync ulang
 *  kalau WAHUB_API_KEY/WAHUB_WEBHOOK_SECRET/APP_BASE_URL berubah, tanpa perlu didaftarkan manual. */
export async function registerWahubWebhook() {
  const appBaseUrl = process.env.APP_BASE_URL
  const webhookSecret = process.env.WAHUB_WEBHOOK_SECRET

  if (!WAHUB_BASE_URL || !WAHUB_API_KEY || !appBaseUrl || !webhookSecret) {
    console.warn(
      "[wahub] Lewati registrasi webhook otomatis — pastikan WAHUB_BASE_URL, WAHUB_API_KEY, APP_BASE_URL, dan WAHUB_WEBHOOK_SECRET semua sudah di-set."
    )
    return
  }

  const webhookUrl = `${appBaseUrl}/api/whatsapp/webhook?secret=${webhookSecret}`

  try {
    const res = await fetch(`${WAHUB_BASE_URL}/api/sessions/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": WAHUB_API_KEY },
      body: JSON.stringify({ webhookUrl }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      console.error(`[wahub] Gagal daftar ulang webhook (${res.status}):`, JSON.stringify(data))
      return
    }
    console.log("[wahub] Webhook otomatis ter-registrasi:", data?.message ?? "sukses")
  } catch (error) {
    console.error("[wahub] Gagal menghubungi WAHUB untuk registrasi webhook:", error)
  }
}
